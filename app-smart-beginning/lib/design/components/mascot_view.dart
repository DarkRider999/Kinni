import 'package:flutter/material.dart';

import '../tokens.dart';

/// Placeholder procedural mascot (SPEC §2.6 / §6.2). Replaced by a Lottie
/// asset (`mascot_*`) in Phase 1; the gentle breathing animation here keeps
/// the scaffold asset-free so it builds and runs before art is produced.
class MascotView extends StatefulWidget {
  const MascotView({super.key, this.size = 96});

  final double size;

  @override
  State<MascotView> createState() => _MascotViewState();
}

class _MascotViewState extends State<MascotView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Mascot',
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.96, end: 1.04).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
        ),
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: const BoxDecoration(
            color: SbColors.secondary,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.emoji_emotions,
            size: 56,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
