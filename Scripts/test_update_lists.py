import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import importlib.util
import sys
import asyncio
from pathlib import Path
import hashlib
import base64

# Import the target module
spec = importlib.util.spec_from_file_location("update_lists", "Scripts/update-lists.py")
update_lists = importlib.util.module_from_spec(spec)
sys.modules["update_lists"] = update_lists
spec.loader.exec_module(update_lists)

class TestUpdateLists(unittest.TestCase):

    def setUp(self):
        self.valid_content_body = "||example.comxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx^\n"
        normalized = self.valid_content_body.replace("\r", "").rstrip("\n") + "\n"
        computed_hash = hashlib.md5(normalized.encode("utf-8")).digest()
        self.checksum = base64.b64encode(computed_hash).decode().rstrip("=")
        self.valid_full_content = f"! checksum: {self.checksum}\n{self.valid_content_body}"

    def test_validate_checksum_valid(self):
        # NOTE: This test assumes validate_checksum has been refactored to accept string
        result = update_lists.validate_checksum(self.valid_full_content)
        self.assertTrue(result)

    def test_validate_checksum_invalid(self):
        # invalid checksum
        content = f"! checksum: INVALID\n{self.valid_content_body}"
        result = update_lists.validate_checksum(content)
        self.assertFalse(result)

    def test_validate_checksum_no_checksum(self):
        content = self.valid_content_body
        result = update_lists.validate_checksum(content)
        self.assertTrue(result)

    @patch('update_lists.validate_checksum')
    @patch('update_lists.aiofiles.open')
    def test_process_downloaded_file_success(self, mock_aio_open, mock_validate):
        # Setup mocks
        mock_validate.return_value = True

        # Mock async file context manager for reading
        mock_file_read = AsyncMock()
        mock_file_read.read.return_value = self.valid_full_content

        # Mock async file context manager for writing
        mock_file_write = AsyncMock()

        # Configure aiofiles.open to return different mocks based on call
        # 1. Read temp path
        # 2. Write dest path
        mock_aio_open.side_effect = [
            MagicMock(__aenter__=AsyncMock(return_value=mock_file_read), __aexit__=AsyncMock()),
            MagicMock(__aenter__=AsyncMock(return_value=mock_file_write), __aexit__=AsyncMock())
        ]

        temp_path = Path("/tmp/temp.txt")
        output_dir = Path("/tmp/out")
        dest_path = output_dir / "final.txt"

        # Mock temp_path.exists/unlink for cleanup check (though not expected to be called on success)
        with patch.object(Path, 'exists', return_value=True), \
             patch.object(Path, 'unlink') as mock_unlink:

            result = asyncio.run(update_lists.process_downloaded_file(
                temp_path, "http://url", "final.txt", output_dir
            ))

            # Verify result
            self.assertEqual(result, dest_path)

            # Verify validate_checksum was called with CONTENT, not path
            mock_validate.assert_called_once_with(self.valid_full_content, 'final.txt')

            # Verify file was read once
            mock_file_read.read.assert_called_once()

            # Verify file was written
            mock_file_write.write.assert_called_once_with(self.valid_full_content)

    @patch('update_lists.validate_checksum')
    @patch('update_lists.aiofiles.open')
    def test_process_downloaded_file_checksum_fail(self, mock_aio_open, mock_validate):
        mock_validate.return_value = False

        mock_file_read = AsyncMock()
        mock_file_read.read.return_value = "some content"

        mock_aio_open.return_value = MagicMock(
            __aenter__=AsyncMock(return_value=mock_file_read),
            __aexit__=AsyncMock()
        )

        temp_path = MagicMock(spec=Path)
        temp_path.exists.return_value = True

        result = asyncio.run(update_lists.process_downloaded_file(
            temp_path, "http://url", "final.txt", Path("/tmp/out")
        ))

        self.assertIsNone(result)
        # Should NOT unlink temp path (delegated to caller)
        temp_path.unlink.assert_not_called()
        # Should call validate with content
        mock_validate.assert_called_once_with("some content", 'final.txt')

if __name__ == '__main__':
    unittest.main()
