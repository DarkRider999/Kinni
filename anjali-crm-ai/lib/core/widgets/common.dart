import 'dart:io';

import 'package:flutter/material.dart';

import '../../domain/entities/enums.dart';
import '../constants/app_assets.dart';
import '../theme/app_colors.dart';

/// Coloured status pill.
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key, this.dense = false});
  final LeadStatus status;
  final bool dense;

  @override
  Widget build(BuildContext context) => Pill(label: status.label, color: AppColors.status(status), dense: dense);
}

class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color, this.dense = false, this.icon});
  final String label;
  final Color color;
  final bool dense;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: dense ? 8 : 10, vertical: dense ? 2 : 4),
        decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(20)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: dense ? 11 : 13, color: color), const SizedBox(width: 4)],
            Text(label, style: TextStyle(color: color, fontSize: dense ? 10.5 : 12, fontWeight: FontWeight.w700)),
          ],
        ),
      );
}

/// Round avatar from a local photo, or gradient initials.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({super.key, this.photoPath, required this.initials, this.size = 44, this.heroTag});
  final String? photoPath;
  final String initials;
  final double size;
  final Object? heroTag;

  @override
  Widget build(BuildContext context) {
    final file = photoPath == null ? null : File(photoPath!);
    final Widget avatar = (file != null && file.existsSync())
        ? CircleAvatar(radius: size / 2, backgroundImage: FileImage(file))
        : Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppColors.brandGradient),
            child: Text(initials, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * .36)),
          );
    return heroTag == null ? avatar : Hero(tag: heroTag!, child: avatar);
  }
}

/// The Anjali logo, circular.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 120, this.glow = true});
  final double size;
  final bool glow;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: glow ? [BoxShadow(color: AppColors.primary.withValues(alpha: .35), blurRadius: size * .3, spreadRadius: 2)] : null,
        ),
        child: ClipOval(child: Image.asset(AppAssets.logo, fit: BoxFit.cover)),
      );
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction, this.icon});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
        child: Row(
          children: [
            if (icon != null) ...[Icon(icon, size: 20, color: AppColors.primary), const SizedBox(width: 8)],
            Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
            if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
          ],
        ),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: .1), shape: BoxShape.circle),
              child: Icon(icon, size: 40, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(message!, textAlign: TextAlign.center, style: t.bodyMedium?.copyWith(color: t.bodySmall?.color)),
            ],
            if (action != null) ...[
              const SizedBox(height: 16),
              FilledButton.tonal(onPressed: onAction, child: Text(action!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Five-star rating (read-only or editable).
class RatingStars extends StatelessWidget {
  const RatingStars({super.key, required this.value, this.onChanged, this.size = 18});
  final int value;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            GestureDetector(
              onTap: onChanged == null ? null : () => onChanged!(value == i ? 0 : i),
              child: Padding(
                padding: EdgeInsets.all(onChanged == null ? 0 : 4),
                child: Icon(i <= value ? Icons.star_rounded : Icons.star_outline_rounded, size: size, color: AppColors.gold),
              ),
            ),
        ],
      );
}

/// Circular lead-score badge.
class ScoreBadge extends StatelessWidget {
  const ScoreBadge(this.score, {super.key, this.size = 34});
  final int score;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.score(score);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(value: score / 100, strokeWidth: 3, color: c, backgroundColor: c.withValues(alpha: .15)),
          Text('$score', style: TextStyle(fontSize: size * .34, fontWeight: FontWeight.w800, color: c)),
        ],
      ),
    );
  }
}

/// Gradient primary call-to-action.
class GradientButton extends StatelessWidget {
  const GradientButton({super.key, required this.label, this.onPressed, this.icon, this.loading = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) => Opacity(
        opacity: onPressed == null ? .5 : 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: .3), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: loading ? null : onPressed,
              child: SizedBox(
                height: 54,
                child: Center(
                  child: loading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (icon != null) ...[Icon(icon, color: Colors.white), const SizedBox(width: 8)],
                            Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
      );
}

/// Shows a floating snackbar.
void showSnack(BuildContext context, String message, {SnackBarAction? action, bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      action: action,
      backgroundColor: error ? AppColors.danger : null,
    ));
}

/// Yes/no confirmation dialog.
Future<bool> confirm(BuildContext context, {required String title, required String message, String ok = 'Confirm', bool destructive = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        FilledButton(
          style: destructive ? FilledButton.styleFrom(backgroundColor: AppColors.danger) : null,
          onPressed: () => Navigator.pop(c, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r ?? false;
}
