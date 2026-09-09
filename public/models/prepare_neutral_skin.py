"""Derive a locally smoothed neutral educational skin from the bundled skin.glb.

Requires numpy. No downloading, remeshing, removed triangles or pixel/image editing.
The original asset is left intact. The input contains open inner/outer skin shells;
this transformation preserves their connectivity and does not claim watertightness.
All distances below are metres in the existing Y-up anatomical coordinate system.
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

ROOT = Path(__file__).resolve().parent


def smoothstep(low, high, values):
    t = np.clip((values - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def positive_part(values, epsilon=.002):
    """C1 compact positive part: exactly zero below zero, derivative in [0,1]."""
    t = np.maximum(values, 0)
    return np.where(t < epsilon, t * t / (2 * epsilon), t - epsilon / 2)


def read_skin(path):
    raw = path.read_bytes()
    if raw[:4] != b'glTF':
        raise ValueError('Expected GLB source')
    json_size = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20 + json_size])
    binary = bytearray(raw[28 + json_size:])
    primitive = document['meshes'][0]['primitives'][0]
    pa = document['accessors'][primitive['attributes']['POSITION']]
    pv = document['bufferViews'][pa['bufferView']]
    offset = pv.get('byteOffset', 0) + pa.get('byteOffset', 0)
    positions = np.frombuffer(binary, dtype='<f4', count=pa['count'] * 3, offset=offset).reshape(-1, 3).copy()
    ia = document['accessors'][primitive['indices']]
    iv = document['bufferViews'][ia['bufferView']]
    indices = np.frombuffer(binary, dtype='<u4', count=ia['count'], offset=iv.get('byteOffset', 0) + ia.get('byteOffset', 0)).reshape(-1, 3).copy()
    return raw, document, binary, offset, positions, indices


def neutralize(original):
    result = original.astype(np.float64).copy()
    x, y, z = result.T.copy()
    # Suppress anterior pubic protrusions with a compact smooth depth contraction.
    # d(new_z)/d(z) >= .04: ordering between inner and outer skin is preserved.
    lateral = 1 - smoothstep(.024, .064, np.abs(x))
    vertical = smoothstep(.735, .765, y) * (1 - smoothstep(.870, .920, y))
    plane = .018 + .045 * smoothstep(.765, .900, y)
    result[:, 2] -= .96 * lateral * vertical * positive_part(z - plane, .003)

    # Raise the flattened, hanging anterior surface into a smooth pubic transition.
    # This is a separate monotone Y transform (minimum derivative >= .08), using
    # the already contracted Z. The inner thighs and posterior perineum stay fixed.
    lateral_lift = 1 - smoothstep(.017, .051, np.abs(x))
    anterior = smoothstep(-.005, .018, result[:, 2])
    lower_falloff = smoothstep(.725, .765, y)
    result[:, 1] += .92 * lateral_lift * anterior * lower_falloff * positive_part(.834 - y, .002)

    # Remove fine nipple relief, fitting the adjacent chest rather than flattening
    # the whole pectoral contour. Both skin shells receive the same monotone fit.
    chest_regions = []
    for cx in (-.106, .106):
        cy = 1.274
        dx, dy = x - cx, y - cy
        radius = np.sqrt(dx * dx + dy * dy)
        ring = (radius >= .020) & (radius <= .032) & (z > .03)
        basis = np.column_stack([np.ones(len(x)), dx, dy, dx * dx, dx * dy, dy * dy])
        coefficients, *_ = np.linalg.lstsq(basis[ring], z[ring], rcond=None)
        fitted = basis @ coefficients
        weight = (1 - smoothstep(.008, .019, radius)) * smoothstep(.03, .06, z)
        correction = .90 * weight * np.clip(z - fitted, -.003, .003)
        result[:, 2] -= correction
        chest_regions.append({'center': [cx, cy], 'supportRadiusM': .019, 'maxAbsDeltaM': float(np.max(np.abs(correction)))})
    return result.astype('<f4'), chest_regions


def topology_report(positions, faces):
    edges = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1)
    _, counts = np.unique(edges, axis=0, return_counts=True)
    doubled_areas = np.linalg.norm(np.cross(positions[faces[:, 1]] - positions[faces[:, 0]], positions[faces[:, 2]] - positions[faces[:, 0]]), axis=1)
    return {
        'vertices': int(len(positions)), 'triangles': int(len(faces)),
        'boundaryEdges': int(np.sum(counts == 1)), 'nonManifoldEdges': int(np.sum(counts > 2)),
        'zeroAreaTriangles': int(np.sum(doubled_areas == 0)),
        'minimumNonzeroTriangleAreaM2': float(np.min(doubled_areas[doubled_areas > 0]) / 2),
    }


def build():
    source = ROOT / 'skin.glb'
    raw, document, binary, offset, original, faces = read_skin(source)
    positions, chest_regions = neutralize(original)
    delta = positions.astype(np.float64) - original.astype(np.float64)
    changed = np.any(positions != original, axis=1)
    groin = (np.abs(original[:, 0]) < .064) & (original[:, 1] > .725) & (original[:, 1] < .920) & (original[:, 2] > -.005)
    chest = (original[:, 2] > .03) & (((original[:, 0] + .106) ** 2 + (original[:, 1] - 1.274) ** 2 < .019 ** 2) | ((original[:, 0] - .106) ** 2 + (original[:, 1] - 1.274) ** 2 < .019 ** 2))
    before, after = topology_report(original, faces), topology_report(positions, faces)
    assert np.isfinite(positions).all()
    assert not np.any(changed & ~(groin | chest)), 'Geometry outside the two anatomical regions changed'
    assert np.array_equal(positions[:, 0], original[:, 0]), 'Transverse body shape changed'
    assert after['zeroAreaTriangles'] <= before['zeroAreaTriangles'], 'New degenerate triangles'
    assert before['boundaryEdges'] == after['boundaryEdges'] and before['nonManifoldEdges'] == after['nonManifoldEdges']
    metrics = {
        'source': 'skin.glb', 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'method': 'Compact monotone anterior pubic depth/lift deformation and local chest relief attenuation; connectivity unchanged.',
        'interpretation': 'Neutral educational exterior derived from a male-source atlas, not a female model or a new anatomical reference.',
        'modifiedVertices': int(changed.sum()), 'unchangedVertices': int((~changed).sum()),
        'groinModifiedVertices': int((changed & groin).sum()), 'chestModifiedVertices': int((changed & chest).sum()),
        'maximumDisplacementM': float(np.linalg.norm(delta, axis=1).max()),
        'maximumAxisDeltaM': np.max(np.abs(delta), axis=0).tolist(),
        'meanModifiedDisplacementM': float(np.linalg.norm(delta[changed], axis=1).mean()),
        'changedOriginalBoundsM': [original[changed].min(axis=0).tolist(), original[changed].max(axis=0).tolist()],
        'chestRegions': chest_regions, 'topologyBefore': before, 'topologyAfter': after,
    }
    binary[offset:offset + positions.nbytes] = positions.tobytes()
    document = copy.deepcopy(document)
    document['asset']['generator'] = 'BodyParts3D neutral educational exterior / prepare_neutral_skin.py'
    document['asset']['extras'] = {'neutralPresentation': metrics}
    document['nodes'][0]['name'] = 'Skin neutral educational presentation'
    pa = document['accessors'][document['meshes'][0]['primitives'][0]['attributes']['POSITION']]
    pa['min'], pa['max'] = positions.min(axis=0).tolist(), positions.max(axis=0).tolist()
    text = json.dumps(document, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary)) + struct.pack('<II', len(text), 0x4E4F534A) + text + struct.pack('<II', len(binary), 0x004E4942) + binary
    (ROOT / 'skin-neutral.glb').write_bytes(output)
    print(json.dumps(metrics, indent=2))


if __name__ == '__main__':
    build()
