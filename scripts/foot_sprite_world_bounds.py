"""Conservative opaque billboard bounds in the existing fixed game camera."""
import math


def placed_sprite_bounds(frames, world_per_pixel):
    camera = (0.78, 1.12, 0.78)
    length = math.sqrt(sum(v * v for v in camera))
    toward = tuple(v / length for v in camera)
    horizontal = math.hypot(toward[0], toward[2])
    right = (toward[2] / horizontal, 0, -toward[0] / horizontal)
    up = (toward[1] * right[2], horizontal, -toward[1] * right[0])
    minimum = [0.0, 0.0, 0.0]
    maximum = [0.0, 0.0, 0.0]
    for frame in frames:
        box = frame['alphaBoundsPx']
        pivot = frame['groundPivotPx']
        below = max(0, box['y'] + box['height'] - pivot['y'])
        bias = below * world_per_pixel * up[1] / toward[1]
        for x in (box['x'], box['x'] + box['width']):
            for y in (box['y'], box['y'] + box['height']):
                local_x = (x - pivot['x']) * world_per_pixel
                local_y = (pivot['y'] - y) * world_per_pixel
                for axis in range(3):
                    value = right[axis] * local_x + up[axis] * local_y + toward[axis] * bias
                    if axis == 1:
                        value += 0.018  # Existing unit sprite ground lift.
                    minimum[axis] = min(minimum[axis], value)
                    maximum[axis] = max(maximum[axis], value)
    return {'min': minimum, 'max': maximum}
