import unittest
from unittest.mock import patch
from mercy.brain import fallback_reply, should_stop, reply

class TestBrain(unittest.TestCase):
    def test_identity(self):
        self.assertIn("Mercy", fallback_reply("who are you"))

    def test_hearing(self):
        self.assertEqual(fallback_reply("can you hear me"), "Every word.")

    def test_goodbye(self):
        self.assertTrue(should_stop("goodbye mercy"))
        self.assertFalse(should_stop("goodbye everybody"))

    def test_unconnected_brain(self):
        self.assertIn("not connected", fallback_reply("what are stars"))

    @patch("mercy.brain.ollama_reply", return_value="A whispered reply")
    def test_ollama_reply(self, mock_ai):
        self.assertEqual(reply("tell me something"), "A whispered reply")

if __name__ == "__main__":
    unittest.main()
