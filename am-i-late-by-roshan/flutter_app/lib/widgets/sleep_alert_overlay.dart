import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Full-screen fatigue warning with haptics and an alert sound until acknowledged.
class SleepAlertOverlay extends StatefulWidget {
  final String level;
  final String recommendation;
  final VoidCallback onTookBreak;
  final VoidCallback onDismiss;

  const SleepAlertOverlay({super.key, required this.level, required this.recommendation, required this.onTookBreak, required this.onDismiss});

  @override
  State<SleepAlertOverlay> createState() => _SleepAlertOverlayState();
}

class _SleepAlertOverlayState extends State<SleepAlertOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..repeat(reverse: true);
  Timer? _buzz;

  @override
  void initState() {
    super.initState();
    _alert();
    _buzz = Timer.periodic(const Duration(seconds: 3), (_) => _alert());
  }

  void _alert() {
    HapticFeedback.heavyImpact();
    SystemSound.play(SystemSoundType.alert);
  }

  @override
  void dispose() {
    _buzz?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final danger = widget.level == 'DANGER';
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) => Container(
        color: (danger ? Colors.red.shade900 : Colors.deepOrange.shade800).withValues(alpha: 0.85 + 0.1 * _pulse.value),
        child: child,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.bedtime, size: 96, color: Colors.white),
              const SizedBox(height: 16),
              Text(danger ? 'Pull over and rest' : 'Time for a break',
                  textAlign: TextAlign.center, style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Text(widget.recommendation, textAlign: TextAlign.center, style: theme.textTheme.titleMedium?.copyWith(color: Colors.white)),
              const SizedBox(height: 32),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black, minimumSize: const Size.fromHeight(56)),
                onPressed: widget.onTookBreak,
                icon: const Icon(Icons.local_cafe),
                label: const Text("I've taken a break"),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: widget.onDismiss,
                child: const Text("I'm OK, remind me later", style: TextStyle(color: Colors.white70)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
