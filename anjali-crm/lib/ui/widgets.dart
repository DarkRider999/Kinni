import 'package:material_ui/material_ui.dart';

import '../data/lead_score.dart';
import '../data/models.dart';

const brandPurple = Color(0xFF6427B8);

Color statusColor(LeadStatus s) => switch (s) {
      LeadStatus.newLead => const Color(0xFF5C6BC0),
      LeadStatus.interested => const Color(0xFF7D3BD1),
      LeadStatus.documentsRequested => const Color(0xFFEF6C00),
      LeadStatus.documentsReceived => const Color(0xFF00897B),
      LeadStatus.applicationSubmitted => const Color(0xFF1E88E5),
      LeadStatus.approved => const Color(0xFF2E7D32),
      LeadStatus.disbursed => const Color(0xFF1B5E20),
      LeadStatus.rejected => const Color(0xFFC62828),
      LeadStatus.notInterested => const Color(0xFF757575),
      LeadStatus.notEligible => const Color(0xFF6D4C41),
    };

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final LeadStatus status;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status.label, style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

class PriorityLabel extends StatelessWidget {
  const PriorityLabel(this.priority, {super.key});
  final Priority priority;

  @override
  Widget build(BuildContext context) {
    final color = switch (priority) {
      Priority.high => const Color(0xFFC62828),
      Priority.medium => const Color(0xFFEF6C00),
      Priority.low => Colors.grey,
    };
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.flag, size: 14, color: color),
      const SizedBox(width: 2),
      Text(priority.label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    ]);
  }
}

/// Read-only stars, or tappable when [onChanged] is set (tap the current
/// star again to clear).
class StarRating extends StatelessWidget {
  const StarRating({super.key, required this.rating, this.onChanged, this.size = 18});
  final int rating;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 1; i <= 5; i++)
          onChanged == null
              ? Icon(i <= rating ? Icons.star : Icons.star_border, size: size, color: const Color(0xFFFFB300))
              : IconButton(
                  key: Key('star-$i'),
                  visualDensity: VisualDensity.compact,
                  tooltip: '$i star${i == 1 ? '' : 's'}',
                  onPressed: () => onChanged!(i == rating ? 0 : i),
                  icon: Icon(i <= rating ? Icons.star : Icons.star_border, size: size, color: const Color(0xFFFFB300)),
                ),
      ]);
}

/// The lead score circle on the client profile.
class ScoreCircle extends StatelessWidget {
  const ScoreCircle(this.client, {super.key});
  final Client client;

  @override
  Widget build(BuildContext context) {
    final score = leadScore(client);
    final color = score >= 60 ? const Color(0xFF2E7D32) : score >= 30 ? const Color(0xFFEF6C00) : const Color(0xFFC62828);
    return Tooltip(
      message: 'Lead score',
      child: SizedBox(
        width: 56,
        height: 56,
        child: Stack(alignment: Alignment.center, children: [
          CircularProgressIndicator(value: score / 100, strokeWidth: 5, color: color, backgroundColor: color.withValues(alpha: 0.15)),
          Text('$score', style: TextStyle(fontWeight: FontWeight.w800, color: color)),
        ]),
      ),
    );
  }
}

class Initials extends StatelessWidget {
  const Initials(this.name, {super.key, this.radius = 20});
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    final text = parts.isEmpty
        ? '?'
        : (parts.first.characters.first + (parts.length > 1 ? parts.last.characters.first : '')).toUpperCase();
    return CircleAvatar(radius: radius, child: Text(text));
  }
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
