import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import importlib.util
import sys
import asyncio
from pathlib import Path
import hashlib
import base64

# Import the target module
# Mock missing dependencies
aiohttp_mock = MagicMock()


class ClientError(Exception):
    pass


aiohttp_mock.ClientError = ClientError
sys.modules["aiohttp"] = aiohttp_mock
sys.modules["aiofiles"] = MagicMock()

spec = importlib.util.spec_from_file_location("update_lists", "Scripts/update_lists.py")
>>>>>>> origin/jules/fix-sys-path-boilerplate-6564146397324574189
update_lists = importlib.util.module_from_spec(spec)
sys.modules["update_lists"] = update_lists
spec.loader.exec_module(update_lists)

# Import specific functions to test
count_rules = update_lists.count_rules
load_sources = update_lists.load_sources


class AsyncIterator:
    def __init__(self, seq):
        self.iter = iter(seq)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.iter)
        except StopIteration:
            raise StopAsyncIteration


class TestUpdateLists(unittest.TestCase):
    def setUp(self):
        self.valid_content_body = "||example.comxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx^\n"
        normalized = self.valid_content_body.replace("\r", "").rstrip("\n") + "\n"
        computed_hash = hashlib.sha256(normalized.encode("utf-8")).digest()
        self.checksum = base64.b64encode(computed_hash).decode().rstrip("=")
        self.valid_full_content = (
            f"! checksum: {self.checksum}\n{self.valid_content_body}"
        )

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

    @patch("update_lists.validate_checksum")
    @patch("update_lists.aiofiles.open")
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
            MagicMock(
                __aenter__=AsyncMock(return_value=mock_file_read), __aexit__=AsyncMock()
            ),
            MagicMock(
                __aenter__=AsyncMock(return_value=mock_file_write),
                __aexit__=AsyncMock(),
            ),
        ]

        temp_path = Path("/tmp/temp.txt")
        output_dir = Path("/tmp/out")
        dest_path = output_dir / "final.txt"

        # Mock temp_path.exists/unlink for cleanup check (though not expected to be called on success)
        with (
            patch.object(Path, "exists", return_value=True),
            patch.object(Path, "unlink") as mock_unlink,
        ):
            result = asyncio.run(
                update_lists.process_downloaded_file(
                    temp_path, "http://url", "final.txt", output_dir
                )
            )

            # Verify result
            self.assertEqual(result, dest_path)

            # Verify validate_checksum was called with CONTENT, not path
            mock_validate.assert_called_once_with(self.valid_full_content, "final.txt")

            # Verify file was read once
            mock_file_read.read.assert_called_once()

            # Verify file was written
            mock_file_write.write.assert_called_once_with(self.valid_full_content)

            # Verify NO unlink called (important for security regression)
            mock_unlink.assert_not_called()

    @patch("update_lists.validate_checksum")
    @patch("update_lists.aiofiles.open")
    def test_process_downloaded_file_checksum_fail(self, mock_aio_open, mock_validate):
        mock_validate.return_value = False

        mock_file_read = AsyncMock()
        mock_file_read.read.return_value = "some content"

        mock_aio_open.return_value = MagicMock(
            __aenter__=AsyncMock(return_value=mock_file_read), __aexit__=AsyncMock()
        )

        temp_path = MagicMock(spec=Path)
        temp_path.exists.return_value = True

        result = asyncio.run(
            update_lists.process_downloaded_file(
                temp_path, "http://url", "final.txt", Path("/tmp/out")
            )
        )

        self.assertIsNone(result)
        # Should NOT unlink temp path (delegated to caller)
        temp_path.unlink.assert_not_called()
        # Should call validate with content
        mock_validate.assert_called_once_with("some content", "final.txt")

    @patch("update_lists.process_downloaded_file")
    @patch("update_lists.aiofiles.open")
    @patch("tempfile.NamedTemporaryFile")
    @patch("asyncio.to_thread")
    def test_fetch_list_cleanup_logic(
        self, mock_to_thread, mock_tempfile, mock_aio_open, mock_process
    ):
        """Verify fetch_list handles cleanup in finally block."""

        # Mock session response
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = MagicMock()
        mock_resp.content.iter_chunked.return_value = AsyncIterator([b"chunk"])

        # Mock session context manager
        session_ctx = MagicMock()
        session_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        session_ctx.__aexit__ = AsyncMock()

        mock_session = MagicMock()
        mock_session.get.return_value = session_ctx

        # Mock temp file creation
        mock_temp = MagicMock()
        mock_temp.name = "/tmp/tempfile.txt"
        mock_tempfile.return_value.__enter__.return_value = mock_temp

        # Mock aiofiles.open (for writing download)
        mock_file_write = AsyncMock()
        write_ctx = MagicMock()
        write_ctx.__aenter__ = AsyncMock(return_value=mock_file_write)
        write_ctx.__aexit__ = AsyncMock()

        mock_aio_open.return_value = write_ctx

        # Mock process_downloaded_file to succeed
        mock_process.return_value = Path("/tmp/out/file.txt")

        # Run fetch_list
        result = asyncio.run(
            update_lists.fetch_list(
                mock_session, "http://url", "file.txt", Path("/tmp/out")
            )
        )

        # Verify process_downloaded_file called ONCE
        mock_process.assert_called_once()

        # Verify cleanup called
        self.assertTrue(mock_to_thread.called)

        # Verify return value
        self.assertEqual(result, ("http://url", True))

    @patch("update_lists.process_downloaded_file")
    @patch("update_lists.aiofiles.open")
    @patch("tempfile.NamedTemporaryFile")
    @patch("asyncio.to_thread")
    def test_fetch_list_success(
        self, mock_to_thread, mock_tempfile, mock_aio_open, mock_process
    ):
        """Verify fetch_list successful download and process."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = MagicMock()
        mock_resp.content.iter_chunked.return_value = AsyncIterator(
            [b"chunk1", b"chunk2"]
        )

        session_ctx = MagicMock()
        session_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        session_ctx.__aexit__ = AsyncMock()

        mock_session = MagicMock()
        mock_session.get.return_value = session_ctx

        mock_temp = MagicMock()
        mock_temp.name = "/tmp/tempfile.txt"
        mock_tempfile.return_value.__enter__.return_value = mock_temp

        mock_file_write = AsyncMock()
        write_ctx = MagicMock()
        write_ctx.__aenter__ = AsyncMock(return_value=mock_file_write)
        write_ctx.__aexit__ = AsyncMock()

        mock_aio_open.return_value = write_ctx

        mock_process.return_value = Path("/tmp/out/file.txt")

        result = asyncio.run(
            update_lists.fetch_list(
                mock_session, "http://url", "file.txt", Path("/tmp/out")
            )
        )

        self.assertEqual(result, ("http://url", True))
        self.assertEqual(mock_file_write.write.call_count, 2)
        mock_session.get.assert_called_once_with(
            "http://url",
            timeout=update_lists.TIMEOUT,
            headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                "Accept": "text/plain,*/*",
            },
        )
        mock_process.assert_called_once_with(
            Path("/tmp/tempfile.txt"), "http://url", "file.txt", Path("/tmp/out"), False
        )

    @patch("update_lists.logger.error")
    def test_fetch_list_timeout(self, mock_logger_error):
        """Verify fetch_list handles TimeoutError."""
        mock_session = MagicMock()
        mock_session.get.side_effect = asyncio.TimeoutError()

        result = asyncio.run(
            update_lists.fetch_list(
                mock_session, "http://url", "file.txt", Path("/tmp/out")
            )
        )

        self.assertEqual(result, ("http://url", False))
        mock_logger_error.assert_called_once_with("✗ Timeout: http://url")

    @patch("update_lists.logger.error")
    def test_fetch_list_http_error(self, mock_logger_error):
        """Verify fetch_list handles aiohttp.ClientError."""
        mock_session = MagicMock()
        mock_session.get.side_effect = update_lists.aiohttp.ClientError("HTTP failed")

        result = asyncio.run(
            update_lists.fetch_list(
                mock_session, "http://url", "file.txt", Path("/tmp/out")
            )
        )

        self.assertEqual(result, ("http://url", False))
        mock_logger_error.assert_called_once_with(
            "✗ HTTP error for http://url: HTTP failed"
        )

    @patch("update_lists.logger.exception")
    def test_fetch_list_unexpected_error(self, mock_logger_exception):
        """Verify fetch_list handles unexpected Exception."""
        mock_session = MagicMock()
        mock_session.get.side_effect = Exception("Boom")

        result = asyncio.run(
            update_lists.fetch_list(
                mock_session, "http://url", "file.txt", Path("/tmp/out")
            )
        )

        self.assertEqual(result, ("http://url", False))
        mock_logger_exception.assert_called_once_with(
            "✗ Unexpected error for http://url: Boom"
        )

    def test_count_rules(self):
        # Empty content
        self.assertEqual(count_rules(""), 0)

        # Only headers
        content = "! Header 1\n! Header 2\n# Comment\n[Adblock Plus]\n"
        self.assertEqual(count_rules(content), 0)

        # Mixed content
        content = """! Header
||example.com^
example.com##.ad
domain.com
# Another comment
||ads.example.com^
"""
        # Should count: ||example.com^, example.com##.ad, domain.com, ||ads.example.com^ = 4
        self.assertEqual(count_rules(content), 4)

        # Content with empty lines
        content = "rule1.com\n\nrule2.com\n\n"
        self.assertEqual(count_rules(content), 2)

        # Windows line endings should be handled
        content = "rule1.com\r\nrule2.com\r\n"
        self.assertEqual(count_rules(content), 2)

    def test_count_rules_with_whitespace(self):
        # Lines with only whitespace should not count
        content = "rule1.com\n   \n\trule2.com\n"
        self.assertEqual(count_rules(content), 2)

    def test_load_sources_template_creation(self):
        """Test load_sources creates template when config doesn't exist."""
        import tempfile
        import json

        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "sources-urls.json"

            # Call load_sources - should create template
            sources = load_sources(config_path)

            # Verify template was created
            self.assertTrue(config_path.exists())

            # Verify it loads the created template
            data = json.loads(config_path.read_text())
            self.assertIn("sources", data)

            # Verify sources is a dict with expected keys
            self.assertIsInstance(sources, dict)
            for url, config in sources.items():
                self.assertIn("filename", config)
                self.assertIn("skip_checksum", config)
                self.assertIn("enabled", config)
                self.assertTrue(config["enabled"])

    def test_load_sources_existing_config(self):
        """Test load_sources loads existing config correctly."""
        import tempfile
        import json

        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "sources-urls.json"

            # Create a test config
            config_data = {
                "sources": [
                    {
                        "url": "https://example.com/list1.txt",
                        "filename": "custom-name.txt",
                        "skip_checksum": True,
                        "enabled": True,
                    },
                    {
                        "url": "https://example.com/list2.txt",
                        "enabled": False,  # Should be filtered out
                    },
                    {
                        "url": "https://example.com/list3.txt",
                        "enabled": True,
                    },
                ]
            }
            config_path.write_text(json.dumps(config_data))

            sources = load_sources(config_path)

            # Should have 2 sources (list2 is disabled)
            self.assertEqual(len(sources), 2)

            # Verify list1
            self.assertIn("https://example.com/list1.txt", sources)
            self.assertEqual(sources["https://example.com/list1.txt"]["filename"], "custom-name.txt")
            self.assertTrue(sources["https://example.com/list1.txt"]["skip_checksum"])

            # Verify list3 (no filename provided - should use sanitize)
            self.assertIn("https://example.com/list3.txt", sources)


if __name__ == "__main__":
    unittest.main()
