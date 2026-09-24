import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'recipe.dart';
import 'state.dart';
import 'theme.dart';

class NeonProgress extends StatelessWidget {
  const NeonProgress({super.key, required this.value, this.status = 'running'});
  final double value;
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'succeeded' || 'completed' => NF.lime,
      'failed' || 'cancelled' => NF.red,
      _ => NF.cyan,
    };
    final v = (status == 'succeeded' || status == 'completed') ? 1.0 : value.clamp(0.0, 1.0);
    return Container(
      height: 6,
      decoration: BoxDecoration(color: NF.elevated, borderRadius: BorderRadius.circular(99)),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: v,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(99),
            boxShadow: status == 'running' ? NF.glow(color) : null,
          ),
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final c = NF.statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(border: Border.all(color: c), borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(status, style: TextStyle(color: c, fontSize: 12)),
      ]),
    );
  }
}

class CreditRing extends StatelessWidget {
  const CreditRing({super.key});

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).me;
    if (me == null) return const SizedBox.shrink();
    final frac = (me.credits / math.max(1, me.plan.monthlyCredits)).clamp(0.0, 1.0);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(value: frac, strokeWidth: 4, color: NF.cyan, backgroundColor: NF.elevated),
      ),
      const SizedBox(width: 8),
      Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text('${me.credits}', key: const Key('credits'), style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
        Text('${me.plan.name} credits', style: const TextStyle(fontSize: 11, color: NF.text2)),
      ]),
    ]);
  }
}

/// Before/after split view: drag anywhere to move the divider.
class CompareSlider extends StatefulWidget {
  const CompareSlider({super.key, required this.before, this.after});
  final String before;
  final String? after;

  @override
  State<CompareSlider> createState() => _CompareSliderState();
}

class _CompareSliderState extends State<CompareSlider> {
  double pos = 0.5;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final before = Image.network(widget.before, fit: BoxFit.contain, width: c.maxWidth, height: c.maxHeight);
      if (widget.after == null) return before;
      return GestureDetector(
        onHorizontalDragUpdate: (d) => setState(() => pos = (d.localPosition.dx / c.maxWidth).clamp(0.0, 1.0)),
        onTapDown: (d) => setState(() => pos = (d.localPosition.dx / c.maxWidth).clamp(0.0, 1.0)),
        child: Stack(children: [
          before,
          ClipRect(
            clipper: _RightClip(pos),
            child: Image.network(widget.after!,
                key: const Key('preview-image'), fit: BoxFit.contain, width: c.maxWidth, height: c.maxHeight,
                gaplessPlayback: true),
          ),
          Positioned(
            left: pos * c.maxWidth - 1,
            top: 0,
            bottom: 0,
            child: Container(width: 2, decoration: BoxDecoration(color: NF.cyan, boxShadow: NF.glow())),
          ),
          const Positioned(left: 8, bottom: 8, child: _Tag('Before')),
          const Positioned(right: 8, bottom: 8, child: _Tag('After')),
        ]),
      );
    });
  }
}

class _RightClip extends CustomClipper<Rect> {
  _RightClip(this.pos);
  final double pos;
  @override
  Rect getClip(Size s) => Rect.fromLTRB(s.width * pos, 0, s.width, s.height);
  @override
  bool shouldReclip(_RightClip old) => old.pos != pos;
}

class _Tag extends StatelessWidget {
  const _Tag(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
      );
}

/// Generic controls for one recipe step (shared by the editor and the batch builder).
class StepEditor extends StatelessWidget {
  const StepEditor({super.key, required this.step, required this.onChanged, this.maxUpscale = 8});
  final EditStep step;
  final VoidCallback onChanged;
  final int maxUpscale;

  @override
  Widget build(BuildContext context) {
    final p = step.params;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(step.meta.description, style: const TextStyle(color: NF.text2, fontSize: 12)),
      const SizedBox(height: 8),
      for (final c in step.meta.controls)
        if (!(step.op == 'background' && c.key == 'aperture' && p['mode'] != 'blur'))
          switch (c.kind) {
            ControlKind.slider => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Text(c.label, style: const TextStyle(fontSize: 12, color: NF.text2)),
                  const Spacer(),
                  Text(c.step < 1 ? (p[c.key] as num).toStringAsFixed(2) : '${(p[c.key] as num).round()}',
                      style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                ]),
                Slider(
                  value: (p[c.key] as num).toDouble().clamp(c.min, c.max),
                  min: c.min,
                  max: c.max,
                  divisions: ((c.max - c.min) / c.step).round(),
                  label: c.label,
                  onChanged: (v) {
                    p[c.key] = c.step < 1 ? double.parse(v.toStringAsFixed(2)) : v.round();
                    onChanged();
                  },
                ),
              ]),
            ControlKind.toggle => SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(c.label),
                value: p[c.key] == true,
                activeThumbColor: NF.cyan,
                onChanged: (v) {
                  p[c.key] = v;
                  onChanged();
                },
              ),
            ControlKind.segment => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(c.label, style: const TextStyle(fontSize: 12, color: NF.text2)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final (value, label) in c.options)
                      ChoiceChip(
                        label: Text(label),
                        selected: p[c.key] == value,
                        onSelected: (step.op == 'upscale' && c.key == 'scale' && (value as int) > maxUpscale)
                            ? null
                            : (_) {
                                p[c.key] = value;
                                onChanged();
                              },
                      ),
                  ]),
                ]),
              ),
          },
    ]);
  }
}

void showError(BuildContext context, Object e) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: NF.elevated));
}
