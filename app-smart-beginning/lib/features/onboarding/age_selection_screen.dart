import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/components/sb_scaffold.dart';
import '../../design/tokens.dart';

/// An age band offered on the Age Selection screen (SPEC §10.02).
class AgeBand {
  const AgeBand(this.id, this.label, this.description);

  final String id;
  final String label;
  final String description;
}

const List<AgeBand> kAgeBands = <AgeBand>[
  AgeBand('0-12m', '0–12 Months', 'Gentle sights & sounds'),
  AgeBand('1-2y', '1–2 Years', 'First words & shapes'),
  AgeBand('2-4y', '2–4 Years', 'Letters, numbers & animals'),
  AgeBand('4-6y', '4–6 Years', 'Reading & counting'),
  AgeBand('6-8y', '6–8 Years', 'Stories, science & music'),
  AgeBand('8-10y', '8–10 Years', 'Challenges & creativity'),
];

/// Age Selection (SPEC §10.02): also the compliance age gate before any PII.
class AgeSelectionScreen extends StatelessWidget {
  const AgeSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SbScaffold(
      title: 'Choose an age',
      body: GridView.count(
        crossAxisCount: 2,
        padding: const EdgeInsets.all(SbSpacing.lg),
        mainAxisSpacing: SbSpacing.lg,
        crossAxisSpacing: SbSpacing.lg,
        childAspectRatio: 0.9,
        children: <Widget>[
          for (final AgeBand band in kAgeBands)
            _AgeCard(band: band, onTap: () => context.go('/home')),
        ],
      ),
    );
  }
}

class _AgeCard extends StatelessWidget {
  const _AgeCard({required this.band, required this.onTap});

  final AgeBand band;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: 'Age ${band.label}, ${band.description}',
      child: Material(
        color: SbColors.surface,
        borderRadius: BorderRadius.circular(SbRadius.lg),
        elevation: 2,
        child: InkWell(
          borderRadius: BorderRadius.circular(SbRadius.lg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(SbSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                const Icon(Icons.child_care, size: 48, color: SbColors.primary),
                const SizedBox(height: SbSpacing.md),
                Text(
                  band.label,
                  textAlign: TextAlign.center,
                  style: textTheme.titleLarge,
                ),
                const SizedBox(height: SbSpacing.xs),
                Text(
                  band.description,
                  textAlign: TextAlign.center,
                  style: textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
