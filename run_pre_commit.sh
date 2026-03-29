# Run tests
python3 -m unittest discover Scripts/ 'test_*.py'

# Test actual script
python3 -m Scripts.deduplicate
