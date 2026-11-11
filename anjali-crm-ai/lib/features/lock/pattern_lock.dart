import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';

/// 3×3 pattern lock. Emits the ordered dot indexes (0–8) on release.
class PatternLock extends StatefulWidget {
  const PatternLock({super.key, required this.onCompleted, this.size = 280, this.light = false, this.errorTick = 0, this.enabled = true});

  final ValueChanged<List<int>> onCompleted;
  final double size;
  final bool light;
  final int errorTick;
  final bool enabled;

  static const minDots = 4;

  @override
  State<PatternLock> createState() => _PatternLockState();
}

class _PatternLockState extends State<PatternLock> {
  final List<int> _dots = [];
  Offset? _finger;
  bool _error = false;

  @override
  void didUpdateWidget(PatternLock old) {
    super.didUpdateWidget(old);
    if (widget.errorTick != old.errorTick) {
      setState(() => _error = true);
      Future.delayed(const Duration(milliseconds: 700), () {
        if (mounted) {
          setState(() {
            _dots.clear();
            _error = false;
          });
        }
      });
    }
  }

  Offset _center(int i) {
    final cell = widget.size / 3;
    return Offset((i % 3) * cell + cell / 2, (i ~/ 3) * cell + cell / 2);
  }

  void _hit(Offset p) {
    final r = widget.size / 9;
    for (var i = 0; i < 9; i++) {
      if (!_dots.contains(i) && (p - _center(i)).distance < r) {
        // Auto-include a skipped middle dot (e.g. 0 → 2 passes 1, 0 → 8 passes 4).
        if (_dots.isNotEmpty) {
          final last = _dots.last;
          final r = (last ~/ 3) + (i ~/ 3);
          final c = (last % 3) + (i % 3);
          if (r.isEven && c.isEven) {
            final mid = (r ~/ 2) * 3 + c ~/ 2;
            if (mid != last && mid != i && !_dots.contains(mid)) _dots.add(mid);
          }
        }
        _dots.add(i);
        HapticFeedback.selectionClick();
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _error ? AppColors.danger : AppColors.secondary;
    final idle = widget.light ? Colors.white54 : Theme.of(context).colorScheme.onSurface.withValues(alpha: .4);
    return GestureDetector(
      onPanStart: widget.enabled
          ? (d) => setState(() {
                _dots.clear();
                _error = false;
                _finger = d.localPosition;
                _hit(d.localPosition);
              })
          : null,
      onPanUpdate: widget.enabled
          ? (d) => setState(() {
                _finger = d.localPosition;
                _hit(d.localPosition);
              })
          : null,
      onPanEnd: widget.enabled
          ? (_) {
              final dots = List<int>.from(_dots);
              setState(() => _finger = null);
              if (dots.isNotEmpty) widget.onCompleted(dots);
              Future.delayed(const Duration(milliseconds: 300), () {
                if (mounted && !_error) setState(_dots.clear);
              });
            }
          : null,
      child: CustomPaint(
        size: Size.square(widget.size),
        painter: _PatternPainter(dots: List.of(_dots), finger: _finger, centerOf: _center, color: color, idle: idle),
      ),
    );
  }
}

class _PatternPainter extends CustomPainter {
  _PatternPainter({required this.dots, required this.finger, required this.centerOf, required this.color, required this.idle});
  final List<int> dots;
  final Offset? finger;
  final Offset Function(int) centerOf;
  final Color color;
  final Color idle;

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = color.withValues(alpha: .8)
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < dots.length - 1; i++) {
      canvas.drawLine(centerOf(dots[i]), centerOf(dots[i + 1]), line);
    }
    if (finger != null && dots.isNotEmpty) canvas.drawLine(centerOf(dots.last), finger!, line);
    for (var i = 0; i < 9; i++) {
      final active = dots.contains(i);
      final c = centerOf(i);
      if (active) canvas.drawCircle(c, 22, Paint()..color = color.withValues(alpha: .18));
      canvas.drawCircle(c, active ? 10 : 7, Paint()..color = active ? color : idle);
    }
  }

  @override
  bool shouldRepaint(_PatternPainter old) => true;
}
