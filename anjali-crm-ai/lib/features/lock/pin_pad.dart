import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';

/// PIN dots + numeric keypad. Shakes on [errorTick] change.
class PinPad extends StatefulWidget {
  const PinPad({
    super.key,
    required this.onCompleted,
    this.length = 6,
    this.minLength = 4,
    this.enabled = true,
    this.errorTick = 0,
    this.leading,
    this.light = false,
  });

  /// Called when [length] digits are entered, or on ✓ with ≥ [minLength].
  final ValueChanged<String> onCompleted;
  final int length;
  final int minLength;
  final bool enabled;
  final int errorTick;

  /// Bottom-left key (e.g. a fingerprint button).
  final Widget? leading;

  /// White-on-dark styling for the lock screen.
  final bool light;

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> with SingleTickerProviderStateMixin {
  String _pin = '';
  late final _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));

  @override
  void didUpdateWidget(PinPad old) {
    super.didUpdateWidget(old);
    if (widget.errorTick != old.errorTick) {
      HapticFeedback.heavyImpact();
      _shake.forward(from: 0);
      setState(() => _pin = '');
    }
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  void _tap(String d) {
    if (!widget.enabled || _pin.length >= widget.length) return;
    HapticFeedback.selectionClick();
    setState(() => _pin += d);
    if (_pin.length == widget.length) {
      final v = _pin;
      Future.microtask(() => widget.onCompleted(v));
    }
  }

  void _back() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  void _submit() {
    if (_pin.length >= widget.minLength) {
      final v = _pin;
      widget.onCompleted(v);
    }
  }

  /// Clears the entry (used by parents after a successful step).
  void clear() => setState(() => _pin = '');

  @override
  Widget build(BuildContext context) {
    final fg = widget.light ? Colors.white : Theme.of(context).colorScheme.onSurface;
    Widget key(String label, {VoidCallback? onTap, Widget? child}) => SizedBox(
          width: 76,
          height: 76,
          child: Material(
            color: widget.light ? Colors.white.withValues(alpha: .08) : AppColors.primary.withValues(alpha: .06),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: widget.enabled ? onTap : null,
              child: Center(child: child ?? Text(label, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w500, color: fg))),
            ),
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _shake,
          builder: (_, child) => Transform.translate(offset: Offset(sin(_shake.value * pi * 6) * 12 * (1 - _shake.value), 0), child: child),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < widget.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 7),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i < _pin.length ? AppColors.secondary : Colors.transparent,
                    border: Border.all(color: i < _pin.length ? AppColors.secondary : fg.withValues(alpha: .5), width: 1.6),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ])
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [for (final d in row) Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: key(d, onTap: () => _tap(d)))],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: widget.leading ??
                    (widget.length > widget.minLength
                        ? key('', onTap: _submit, child: Icon(Icons.check_rounded, color: fg, size: 28))
                        : const SizedBox(width: 76, height: 76)),
              ),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: key('0', onTap: () => _tap('0'))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: key('', onTap: _back, child: Icon(Icons.backspace_outlined, color: fg)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
