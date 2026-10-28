import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add current directory to path
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from common import is_valid_domain, read_lines, write_lines


class TestCommon(unittest.TestCase):
    def test_is_valid_domain(self):
        self.assertTrue(is_valid_domain("example.com"))
        self.assertTrue(is_valid_domain("sub.example.com"))
        self.assertTrue(is_valid_domain("my-domain.co.uk"))
        self.assertFalse(is_valid_domain("invalid"))
        self.assertFalse(is_valid_domain("-start.com"))
        self.assertFalse(is_valid_domain("end-.com"))
        self.assertFalse(is_valid_domain("http://example.com"))

    def test_read_lines(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            target_file = temp_dir_path / "test.txt"
            target_file.write_text("line1 \nline2\r\nline3", encoding="utf-8", newline="")

            lines = read_lines(target_file)
            self.assertEqual(lines, ["line1", "line2", "line3"])

    def test_read_lines_raises_on_unicode_error(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            bad = Path(temp_dir) / "bad.txt"
            bad.write_bytes(b"\xff\xfe\x00bad")
            with self.assertRaises(UnicodeError):
                read_lines(bad)

    def test_read_lines_raises_when_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir, self.assertRaises(FileNotFoundError):
            read_lines(Path(temp_dir) / "missing.txt")

    def test_write_lines_atomic(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target_file = Path(temp_dir) / "target.txt"

            write_lines(target_file, ["line1", "line2"])
            self.assertEqual(target_file.read_text(encoding="utf-8"), "line1\nline2\n")

            write_lines(target_file, ["line3", "line4"])
            self.assertEqual(target_file.read_text(encoding="utf-8"), "line3\nline4\n")

            write_lines(target_file, ["line5"], append=True)
            self.assertEqual(target_file.read_text(encoding="utf-8"), "line3\nline4\nline5\n")

    def test_write_lines_failure_keeps_target_and_leaves_no_temp(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target_file = Path(temp_dir) / "target.txt"
            target_file.write_text("keep\n", encoding="utf-8")
            with patch.object(Path, "replace", side_effect=OSError("mock replace error")), self.assertRaises(OSError):
                write_lines(target_file, ["new"])
            self.assertEqual(target_file.read_text(encoding="utf-8"), "keep\n")
            self.assertEqual([p.name for p in Path(temp_dir).iterdir()], ["target.txt"])

    @patch("pathlib.Path.open")
    def test_write_lines_append_raises(self, mock_open):
        mock_open.side_effect = OSError("mock os error append")
        with self.assertRaises(OSError):
            write_lines(Path("dummy.txt"), ["line1"], append=True)

    @patch("tempfile.mkstemp")
    def test_write_lines_atomic_raises(self, mock_mkstemp):
        mock_mkstemp.side_effect = OSError("mock os error atomic")
        with self.assertRaises(OSError):
            write_lines(Path("dummy.txt"), ["line1"])


if __name__ == "__main__":
    unittest.main()
