"""
Unit tests for mask strictness enforcement.
"""

import numpy as np
import pytest
import sys
sys.path.insert(0, '../pipeline')

from verify import verify_pixel_diff


def test_no_changes_outside_mask():
    """Test that identical images pass verification."""
    img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[40:60, 40:60] = 255
    
    passed, count = verify_pixel_diff(img, img.copy(), mask)
    assert passed is True
    assert count == 0


def test_changes_inside_mask_ok():
    """Test that changes inside mask pass verification."""
    before = np.zeros((100, 100, 3), dtype=np.uint8)
    after = before.copy()
    
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[40:60, 40:60] = 255
    
    # Change inside mask
    after[45:55, 45:55] = [255, 255, 255]
    
    passed, count = verify_pixel_diff(before, after, mask)
    assert passed is True
    assert count == 0


def test_changes_outside_mask_fail():
    """Test that changes outside mask fail verification."""
    before = np.zeros((100, 100, 3), dtype=np.uint8)
    after = before.copy()
    
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[40:60, 40:60] = 255
    
    # Change OUTSIDE mask (should fail)
    after[10:20, 10:20] = [255, 255, 255]
    
    passed, count = verify_pixel_diff(before, after, mask)
    assert passed is False
    assert count > 0


def test_tolerance_handles_minor_artifacts():
    """Test that tolerance handles compression artifacts."""
    before = np.full((100, 100, 3), 100, dtype=np.uint8)
    after = before.copy()
    
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[40:60, 40:60] = 255
    
    # Minor change (within tolerance)
    after[10, 10] = [102, 102, 102]
    
    passed, count = verify_pixel_diff(before, after, mask, tolerance=3)
    assert passed is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
