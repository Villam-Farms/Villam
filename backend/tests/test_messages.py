import os
import unittest
from unittest.mock import MagicMock, patch

# Import the app without connecting to a real Supabase project.
with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test"}), patch("supabase.create_client"):
    from app import main


class MessageHistoryTests(unittest.TestCase):
    def test_returns_latest_window_and_marks_only_returned_messages_read(self):
        messages = [
            {"id": str(i), "thread_id": "t", "sender_user_id": "other",
             "recipient_user_id": "viewer", "body": str(i),
             "created_at": str(i), "read_at": None}
            for i in range(1, 602)
        ]
        query = MagicMock()
        for method in ("select", "eq", "order", "limit", "update", "in_", "is_"):
            getattr(query, method).return_value = query
        query.execute.return_value.data = list(reversed(messages[-500:]))
        client = MagicMock()
        client.table.return_value = query
        with patch.object(main, "supabase", client), patch.object(main, "_ensure_thread_participant", return_value={}), patch.object(main, "_get_profile_map", return_value={}), patch.object(main, "_build_thread_summary", return_value=main.ConversationThreadOut(id="t", farm_id="f")):
            result = main.get_thread("t", "viewer")
        self.assertEqual(result.messages[0].id, "102")
        self.assertEqual(result.messages[-1].id, "601")
        query.order.assert_any_call("created_at", desc=True)
        query.limit.assert_called_once_with(500)
        query.in_.assert_called_once_with("id", [str(i) for i in range(102, 602)])
        self.assertTrue(all(message.read_at for message in result.messages))


if __name__ == "__main__":
    unittest.main()
