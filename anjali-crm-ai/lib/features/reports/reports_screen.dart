import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/stat_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/followup.dart';
import '../../domain/entities/product.dart';
import '../../domain/services/report_engine.dart';
import '../../providers/app_providers.dart';
import 'charts.dart';
import 'export_actions.dart';

/// Reports tab (FR REP-01…05).
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  ReportPeriod _period = ReportPeriod.thisMonth;
  ReportGroup _group = ReportGroup.product;
  ExportKind? _exporting;

  Future<void> _export(ExportKind k) async {
    setState(() => _exporting = k);
    await exportAndShare(context, ref, k, _period);
    if (mounted) setState(() => _exporting = null);
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(nowProvider);
    final all = ref.watch(clientsProvider).value ?? const <Client>[];
    final products = ref.watch(productsProvider).value ?? const <Product>[];
    final clients = ReportEngine.inPeriod(all, _period, now);
    final ids = clients.map((c) => c.id).toSet();
    final followups = (ref.watch(followupsProvider).value ?? const <Followup>[]).where((f) => ids.contains(f.clientId)).toList();
    final k = ReportEngine.kpis(clients, followups, now: now, clientsWithPendingDocs: ref.watch(clientsWithPendingDocsProvider));
    final rows = ReportEngine.groupBy(_group, clients, products);
    final sources = ReportEngine.groupBy(ReportGroup.source, clients, products);
    final t = Theme.of(context).textTheme;

    Widget kpi(String l, String v, IconData i, Color c) => StatCard(label: l, value: v, icon: i, color: c);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: TabBackground(
        image: AppAssets.tabBackgrounds[4],
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
            children: [
              Row(children: [
                Expanded(child: Text('Reports', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
                DropdownButton<ReportPeriod>(
                  value: _period,
                  underline: const SizedBox.shrink(),
                  borderRadius: BorderRadius.circular(14),
                  items: [for (final p in ReportPeriod.values) DropdownMenuItem(value: p, child: Text(p.label))],
                  onChanged: (p) => setState(() => _period = p!),
                ),
              ]),
              const SizedBox(height: 8),
              LayoutBuilder(builder: (context, c) {
                final cols = c.maxWidth >= 560 ? 3 : 2;
                final w = (c.maxWidth - 10 * (cols - 1)) / cols;
                final cards = [
                  kpi('Approval %', Fmt.percent(k.approvalRate), Icons.verified_rounded, AppColors.success),
                  kpi('Rejection %', Fmt.percent(k.rejectionRate), Icons.cancel_rounded, AppColors.danger),
                  kpi('Conversion %', Fmt.percent(k.conversionRate), Icons.trending_up_rounded, AppColors.primary),
                  kpi('Avg followups / lead', k.avgFollowups.toStringAsFixed(1), Icons.repeat_rounded, AppColors.info),
                  kpi('Leads', '${k.total}', Icons.groups_rounded, AppColors.secondary),
                  kpi('Disbursed', Fmt.aedCompact(k.disbursedAmount), Icons.payments_rounded, AppColors.gold),
                ];
                return Wrap(spacing: 10, runSpacing: 10, children: [for (final w0 in cards) SizedBox(width: w, child: w0)]);
              }),
              const SectionHeader('Breakdown', icon: Icons.stacked_bar_chart_rounded),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (final g in ReportGroup.values)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(label: Text(g.label), selected: _group == g, onSelected: (_) => setState(() => _group = g)),
                    ),
                ]),
              ),
              const SizedBox(height: 10),
              GlassCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Leads vs converted by ${_group.label.toLowerCase()}', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  _group == ReportGroup.status ? StatusDistributionChart(k.byStatus) : ProductPerformanceChart(rows),
                  const SizedBox(height: 12),
                  _GroupTable(rows: rows),
                ]),
              ),
              const SectionHeader('Approval conversion', icon: Icons.speed_rounded),
              GlassCard(child: ApprovalRateGauge(k.approvalRate)),
              const SectionHeader('Lead source performance', icon: Icons.campaign_rounded),
              GlassCard(child: _GroupTable(rows: sources)),
              const SectionHeader('Export', icon: Icons.ios_share_rounded),
              Row(children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _exporting == null ? () => _export(ExportKind.excel) : null,
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
                    icon: _exporting == ExportKind.excel
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.table_chart_rounded),
                    label: const Text('Excel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _exporting == null ? () => _export(ExportKind.pdf) : null,
                    style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                    icon: _exporting == ExportKind.pdf
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.picture_as_pdf_rounded),
                    label: const Text('PDF'),
                  ),
                ),
              ]),
              const SizedBox(height: 6),
              Text(
                'Excel includes sheets: All Leads, Approved, Rejected, Documents Pending, Followups, Disbursed.',
                style: t.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupTable extends StatelessWidget {
  const _GroupTable({required this.rows});
  final List<GroupRow> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const Padding(padding: EdgeInsets.all(8), child: Text('No data for this period'));
    final head = Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w800);
    TableRow row(List<String> cells, {TextStyle? style}) => TableRow(children: [
          for (var i = 0; i < cells.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
              child: Text(cells[i], textAlign: i == 0 ? TextAlign.left : TextAlign.right, style: style, maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
        ]);
    return Table(
      columnWidths: const {0: FlexColumnWidth(2.4), 1: FlexColumnWidth(1), 2: FlexColumnWidth(1.2), 3: FlexColumnWidth(1.2), 4: FlexColumnWidth(1.8)},
      border: TableBorder(horizontalInside: BorderSide(color: Theme.of(context).dividerColor)),
      children: [
        row(const ['Group', 'Leads', 'Conv.', 'Rate', 'Disbursed'], style: head),
        for (final r in rows) row([r.label, '${r.leads}', '${r.converted}', Fmt.percent(r.conversionRate), Fmt.aedCompact(r.disbursed)]),
      ],
    );
  }
}
