import 'package:flutter/material.dart';

import '../../core/utils/formatters.dart';

/// Date + time picker with quick presets. Returns null if cancelled.
Future<DateTime?> pickDateTime(BuildContext context, {DateTime? initial, String title = 'Schedule followup'}) async {
  final now = DateTime.now();
  final presets = <(String, DateTime)>[
    ('In 1 hour', now.add(const Duration(hours: 1))),
    ('This evening 6 PM', DateTime(now.year, now.month, now.day, 18)),
    ('Tomorrow 10 AM', DateTime(now.year, now.month, now.day + 1, 10)),
    ('In 3 days', DateTime(now.year, now.month, now.day + 3, 10)),
    ('Next week', DateTime(now.year, now.month, now.day + 7, 10)),
  ].where((p) => p.$2.isAfter(now)).toList();

  final choice = await showModalBottomSheet<Object>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(title, style: Theme.of(c).textTheme.titleMedium)),
          for (final p in presets)
            ListTile(
              leading: const Icon(Icons.schedule_rounded),
              title: Text(p.$1),
              subtitle: Text(Fmt.dateTime(p.$2)),
              onTap: () => Navigator.pop(c, p.$2),
            ),
          ListTile(leading: const Icon(Icons.edit_calendar_rounded), title: const Text('Pick date & time…'), onTap: () => Navigator.pop(c, 'custom')),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (choice is DateTime) return choice;
  if (choice != 'custom' || !context.mounted) return null;
  final start = initial ?? now.add(const Duration(hours: 1));
  final d = await showDatePicker(
      context: context, initialDate: start.isBefore(now) ? now : start, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 3));
  if (d == null || !context.mounted) return null;
  final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(start));
  if (t == null) return null;
  return DateTime(d.year, d.month, d.day, t.hour, t.minute);
}
