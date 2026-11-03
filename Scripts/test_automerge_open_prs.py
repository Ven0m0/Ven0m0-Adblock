import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts import automerge_open_prs as am  # noqa: E402  (after sys.path bootstrap)


def _pr(number: int, **overrides):
    pr = {
        "number": number,
        "title": f"PR {number}",
        "isDraft": False,
        "mergeStateStatus": "CLEAN",
        "headRefName": "feature",
        "headRepository": {"name": "repo"},
        "headRepositoryOwner": {"login": "owner"},
        "isCrossRepository": False,
        "maintainerCanModify": True,
    }
    return {**pr, **overrides}


class TestMergePr(unittest.TestCase):
    def test_plain_squash_merge_wins_first(self):
        with patch.object(am, "_succeeds", return_value=True) as ran:
            self.assertTrue(am.merge_pr(7))
        ran.assert_called_once_with("gh", "pr", "merge", "7", "--squash", "--delete-branch")

    def test_falls_back_to_admin_merge(self):
        with (
            patch.object(am, "ALLOW_ADMIN_MERGE", True),
            patch.object(am, "_succeeds", side_effect=[False, True]) as ran,
        ):
            self.assertTrue(am.merge_pr(7))
        self.assertEqual(ran.call_args_list[1].args[4], "--admin")

    def test_admin_merge_disabled_stops_after_first_failure(self):
        with patch.object(am, "ALLOW_ADMIN_MERGE", False), patch.object(am, "_succeeds", return_value=False) as ran:
            self.assertFalse(am.merge_pr(7))
        ran.assert_called_once()


class TestMainDecisions(unittest.TestCase):
    def _run(self, prs_by_cycle, *, merge=True, sync=True):
        env = {"GH_TOKEN": "t"}
        with (
            patch.dict("os.environ", env),
            patch.object(am, "has", return_value=True),
            patch.object(am, "_run"),
            patch.object(am, "list_prs", side_effect=prs_by_cycle),
            patch.object(am, "mark_ready") as ready,
            patch.object(am, "merge_pr", return_value=merge) as merged,
            patch.object(am, "sync_branch", return_value=sync) as synced,
        ):
            try:
                am.main()
                code = 0
            except SystemExit as e:
                code = e.code
        return code, ready, merged, synced

    def test_merges_until_no_prs_remain(self):
        code, _, merged, _ = self._run([[_pr(1)], []])
        self.assertEqual(code, 0)
        merged.assert_called_once_with(1)

    def test_draft_is_marked_ready_before_merging(self):
        code, ready, merged, _ = self._run([[_pr(1, isDraft=True)], [_pr(1)], []])
        self.assertEqual(code, 0)
        ready.assert_called_once_with(1)
        merged.assert_called_once_with(1)

    def test_behind_pr_is_synced_not_merged(self):
        code, _, merged, synced = self._run([[_pr(1, mergeStateStatus="BEHIND")], [_pr(1)], []])
        self.assertEqual(code, 0)
        synced.assert_called_once()
        merged.assert_called_once_with(1)

    def test_cross_repo_pr_without_maintainer_edits_blocks(self):
        code, _, merged, synced = self._run(
            [[_pr(1, mergeStateStatus="DIRTY", isCrossRepository=True, maintainerCanModify=False)]]
        )
        self.assertEqual(code, 1)
        synced.assert_not_called()
        merged.assert_not_called()

    def test_unmergeable_pr_exits_nonzero(self):
        code, *_ = self._run([[_pr(1)]], merge=False)
        self.assertEqual(code, 1)

    def test_missing_token_is_fatal(self):
        with (
            patch.dict("os.environ", {}, clear=True),
            patch.object(am, "has", return_value=True),
            self.assertRaises(SystemExit) as cm,
        ):
            am.main()
        self.assertEqual(cm.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
