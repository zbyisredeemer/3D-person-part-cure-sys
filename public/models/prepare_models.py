"""Reproducible, non-destructive glTF extraction; source attribution in ATTRIBUTION.md."""
import copy
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).parent


def write_glb(path, doc, binary):
    while len(binary) % 4:
        binary += b'\0'
    doc['buffers'] = [{'byteLength': len(binary)}]
    raw = json.dumps(doc, separators=(',', ':')).encode()
    raw += b' ' * (-len(raw) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(raw) + len(binary)) + struct.pack('<II', len(raw), 0x4E4F534A) + raw + struct.pack('<II', len(binary), 0x004E4942) + binary)


def subset(source, dest, predicate):
    data = (ROOT / source).read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    out = {'asset': {'version': '2.0', 'generator': '知体 Z-Anatomy subset'}, 'extensionsUsed': doc.get('extensionsUsed', []), 'extensionsRequired': doc.get('extensionsRequired', []), 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'materials': doc.get('materials', [])}
    out_binary = bytearray()
    views = {}
    accessors = {}

    def view(old):
        if old not in views:
            v = copy.deepcopy(doc['bufferViews'][old])
            start = v.get('byteOffset', 0)
            while len(out_binary) % 4:
                out_binary.append(0)
            v['byteOffset'] = len(out_binary)
            out_binary.extend(binary[start:start + v['byteLength']])
            views[old] = len(out['bufferViews'])
            out['bufferViews'].append(v)
        return views[old]

    def accessor(old):
        if old not in accessors:
            a = copy.deepcopy(doc['accessors'][old])
            if 'bufferView' in a:
                a['bufferView'] = view(a['bufferView'])
            accessors[old] = len(out['accessors'])
            out['accessors'].append(a)
        return accessors[old]

    for node in doc['nodes']:
        if 'mesh' not in node or not predicate(node['name']):
            continue
        n = copy.deepcopy(node)
        n.pop('children', None)
        mesh = copy.deepcopy(doc['meshes'][n['mesh']])
        for p in mesh['primitives']:
            p['attributes'] = {k: accessor(v) for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = accessor(p['indices'])
            if 'KHR_draco_mesh_compression' in p.get('extensions', {}):
                ext = p['extensions']['KHR_draco_mesh_compression']
                ext['bufferView'] = view(ext['bufferView'])
        n['mesh'] = len(out['meshes'])
        out['meshes'].append(mesh)
        out['nodes'].append(n)
    out['scene'] = 0
    out['scenes'] = [{'nodes': list(range(len(out['nodes'])))}]
    write_glb(ROOT / dest, out, out_binary)
    print(dest, len(out['nodes']), 'meshes', (ROOT / dest).stat().st_size, 'bytes')


def make_skin(source):
    positions = []
    indices = []
    for line in Path(source).read_text().splitlines():
        if line.startswith('v '):
            x, y, z = map(float, line.split()[1:4])
            # BodyParts3D is Z-up millimeters. Z-Anatomy uses Y-up meters.
            positions.append((x / 1000, (z + 78.1112) / 1000, -y / 1000 - .113))
        elif line.startswith('f '):
            vs = [int(v.split('/')[0]) - 1 for v in line.split()[1:]]
            for i in range(1, len(vs) - 1):
                indices.extend([vs[0], vs[i], vs[i + 1]])
    flat = [v for p in positions for v in p]
    pos = struct.pack('<' + str(len(flat)) + 'f', *flat)
    ind = struct.pack('<' + str(len(indices)) + 'I', *indices)
    doc = {'asset': {'version': '2.0', 'generator': 'BodyParts3D FJ2810 coordinate conversion'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'Skin'}], 'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1}]}], 'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(pos), 'target': 34962}, {'buffer': 0, 'byteOffset': len(pos), 'byteLength': len(ind), 'target': 34963}], 'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3', 'min': [min(p[i] for p in positions) for i in range(3)], 'max': [max(p[i] for p in positions) for i in range(3)]}, {'bufferView': 1, 'componentType': 5125, 'count': len(indices), 'type': 'SCALAR'}]}
    write_glb(ROOT / 'skin.glb', doc, pos + ind)


if __name__ == '__main__':
    import re
    subset('skeleton.glb', 'bones.glb', lambda n: '.g.' not in n)
    subset('visceral.glb', 'organs.glb', lambda n: '.g.' not in n and not re.search(r'testis|epididymis|deferens|seminal|prostate|ejaculatory|penis|omentum|mesocolon|meso-appendix|pleura|mucosa of stomach|segment of liver|hypophysis|thyroid|pineal|suprarenal', n, re.I))
    subset('cardiovascular.glb', 'heart.glb', lambda n: bool(re.search(r'^(Right atrium|Right ventricle|Left atrium|Left ventricle|Pulmonary trunk|Bifurcation of pulmonary trunk|Ascending aorta|Arch of aorta|Superior vena cava|Inferior vena cava|Coronary|Anterior interventricular|Right coronary|Left coronary)', n)))
    subset('nervous.glb', 'head.glb', lambda n: '.g.' not in n and not re.search(r'spinal', n, re.I) and bool(re.search(r'gyrus|gyri|sulcus|sulci|temporal pole|occipital pole|cerebell|vermis|lobule|sclera|iris|cornea|auricle', n, re.I)))
    make_skin('/tmp/anatomy-skin.obj')
