/// Edit operations (mirrors web/src/lib/recipe.ts and the backend's recipe schema).
library;

enum ControlKind { slider, toggle, segment }

class Control {
  const Control.slider(this.key, this.label, this.min, this.max, {this.step = 1})
      : kind = ControlKind.slider,
        options = const [];
  const Control.toggle(this.key, this.label)
      : kind = ControlKind.toggle,
        min = 0,
        max = 1,
        step = 1,
        options = const [];
  const Control.segment(this.key, this.label, this.options)
      : kind = ControlKind.segment,
        min = 0,
        max = 1,
        step = 1;

  final ControlKind kind;
  final String key, label;
  final double min, max, step;
  final List<(Object, String)> options;
}

class OpMeta {
  const OpMeta(this.op, this.label, this.panel, this.description, this.defaults, this.controls,
      {this.videoOnly = false});
  final String op, label, panel, description;
  final Map<String, Object?> defaults;
  final List<Control> controls;
  final bool videoOnly;
}

const _faces = Control.segment('faces', 'Apply to', [('all', 'All faces'), ('largest', 'Main face')]);

const Map<String, OpMeta> kOps = {
  'enhance': OpMeta('enhance', 'Auto Enhance', 'enhance', 'Denoise, white balance, levels, clarity and sharpening.', {
    'auto': true, 'strength': 70, 'denoise': 30, 'sharpness': 40, 'clarity': 30, 'exposure': 0.0, 'contrast': 0,
    'saturation': 0, 'white_balance': true,
  }, [
    Control.toggle('auto', 'Auto (analyse & correct)'),
    Control.slider('strength', 'Strength', 0, 100),
    Control.slider('denoise', 'Denoise', 0, 100),
    Control.slider('sharpness', 'Sharpness', 0, 100),
    Control.slider('clarity', 'Clarity', 0, 100),
    Control.slider('exposure', 'Exposure', -2, 2, step: 0.1),
    Control.slider('contrast', 'Contrast', -100, 100),
    Control.slider('saturation', 'Saturation', -100, 100),
  ]),
  'hdr': OpMeta('hdr', 'HDR', 'enhance', 'Recover highlights and lift shadows.', {'intensity': 60},
      [Control.slider('intensity', 'Intensity', 0, 100)]),
  'upscale': OpMeta('upscale', 'Upscale', 'upscale', 'Super-resolution upscaling.', {'scale': 2, 'model': 'auto'}, [
    Control.segment('scale', 'Scale', [(2, '2x'), (4, '4x'), (8, '8x')]),
    Control.segment('model', 'Model', [('auto', 'Auto'), ('photo', 'Photo'), ('anime', 'Anime')]),
  ]),
  'color_grade': OpMeta('color_grade', 'Color Grade', 'color', 'Cinematic looks, identical on every frame.', {
    'lut': 'cinematic_teal_orange', 'intensity': 0.7,
  }, [
    Control.segment('lut', 'Look', [
      ('cinematic_teal_orange', 'Cinematic'), ('film', 'Film'), ('noir', 'Noir'), ('vivid', 'Vivid'),
      ('warm', 'Warm'), ('cool', 'Cool'), ('neon', 'Neon'),
    ]),
    Control.slider('intensity', 'Intensity', 0, 1, step: 0.05),
  ]),
  'face_retouch': OpMeta('face_retouch', 'Skin & Eyes', 'face', 'Texture-preserving smoothing and blemish removal.', {
    'smooth': 35, 'blemish': true, 'eyes': 20, 'faces': 'all',
  }, [
    Control.slider('smooth', 'Skin smoothing', 0, 100),
    Control.toggle('blemish', 'Blemish removal'),
    Control.slider('eyes', 'Eye enhance', 0, 100),
    _faces,
  ]),
  'face_restore': OpMeta('face_restore', 'Face Restore', 'face', 'Recover detail in soft or old portraits.',
      {'fidelity': 0.7, 'faces': 'all'}, [Control.slider('fidelity', 'Fidelity', 0, 1, step: 0.05), _faces]),
  'background': OpMeta('background', 'Background', 'background', 'Remove, replace or blur the background.', {
    'mode': 'blur', 'fill': 'transparent', 'color': '#FFFFFF', 'source': 'preset',
    'preset_id': 'background.studio_white', 'aperture': 2.8, 'edge_refine': true,
  }, [
    Control.segment('mode', 'Mode', [('remove', 'Remove'), ('replace', 'Replace'), ('blur', 'Blur')]),
    Control.slider('aperture', 'Aperture (lower = more blur)', 1, 16, step: 0.1),
    Control.toggle('edge_refine', 'Refine edges'),
  ]),
  'stabilize': OpMeta('stabilize', 'Stabilize', 'motion', 'Smooth shaky footage.', {'strength': 'standard', 'crop_pct': 8}, [
    Control.segment('strength', 'Strength', [('standard', 'Standard'), ('strong', 'Strong'), ('tripod', 'Tripod')]),
    Control.slider('crop_pct', 'Border crop %', 0, 20),
  ], videoOnly: true),
};

const kPanels = <(String, String, List<String>)>[
  ('enhance', 'Enhance', ['enhance', 'hdr']),
  ('face', 'Face', ['face_retouch', 'face_restore']),
  ('background', 'Background', ['background']),
  ('upscale', 'Upscale', ['upscale']),
  ('color', 'Color', ['color_grade']),
  ('motion', 'Motion', ['stabilize']),
  ('swap', 'Face Swap', []),
  ('dress', 'Dress Swap', []),
];

class EditStep {
  EditStep(this.op, Map<String, Object?> params, {this.enabled = true}) : params = Map.of(params);
  factory EditStep.create(String op) => EditStep(op, kOps[op]!.defaults);

  final String op;
  final Map<String, Object?> params;
  bool enabled;

  OpMeta get meta => kOps[op]!;

  Map<String, dynamic> toJson() => {
        'op': op,
        'params': {
          for (final k in meta.defaults.keys)
            if (params[k] != null) k: params[k],
        },
        'enabled': enabled,
      };

  String get summary => switch (op) {
        'upscale' => 'Upscale ${params['scale']}x',
        'background' => 'BG ${params['mode']}',
        'color_grade' => 'Grade · ${params['lut']}',
        _ => meta.label,
      };
}

Map<String, dynamic> buildRecipe(List<EditStep> steps, {Map<String, dynamic>? output}) => {
      'version': 1,
      'steps': steps.map((s) => s.toJson()).toList(),
      'output': ?output,
    };

bool appliesTo(String op, String kind) => !(kOps[op]?.videoOnly ?? false) || kind != 'image';

const kResolutions = [('sd', 'SD'), ('hd', 'HD'), ('fhd', 'Full HD'), ('4k', '4K'), ('8k', '8K'), ('original', 'Original')];
const _resOrder = ['sd', 'hd', 'fhd', '4k', '8k'];

bool resolutionAllowed(String res, String planMax) =>
    res == 'original' || _resOrder.indexOf(res) <= _resOrder.indexOf(planMax);

String formatBytes(int n) {
  if (n < 1024) return '$n B';
  if (n < 1024 * 1024) return '${(n / 1024).toStringAsFixed(0)} KB';
  return '${(n / 1024 / 1024).toStringAsFixed(1)} MB';
}
