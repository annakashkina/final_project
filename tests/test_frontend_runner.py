"""Run frontend JS tests via Node.js.

Falls back to skip if Node.js is not installed.

Run:  python3 -m pytest tests/test_frontend_runner.py -v
"""

import os
import subprocess
import unittest


class TestFrontend(unittest.TestCase):
    def test_frontend_js(self):
        js_path = os.path.join(os.path.dirname(__file__), "test_frontend.js")

        try:
            result = subprocess.run(
                ["node", "--experimental-default-type=module", js_path],
                capture_output=True,
                text=True,
                timeout=10,
            )
        except FileNotFoundError:
            self.skipTest("Node.js not installed — run tests/test_frontend.html in a browser instead")
            return

        print(result.stdout)
        if result.stderr:
            print(result.stderr)

        self.assertEqual(result.returncode, 0, f"Frontend tests failed:\n{result.stdout}")


if __name__ == "__main__":
    unittest.main()
