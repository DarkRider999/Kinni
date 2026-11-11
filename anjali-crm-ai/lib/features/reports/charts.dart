import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../domain/entities/enums.dart';
import '../../domain/services/report_engine.dart';

/// Reusable dashboard / report charts. Each widget is self-contained, sizes
/// itself to its parent's width with a fixed height, and adapts to the
/// current brightness.

const _chartHeight = 200.0;

Color _muted(BuildContext context) => Theme.of(context).brightness == Brightness.dark ? Colors.white60 : Colors.black54;

Color _grid(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? Colors.white.withValues(alpha: .08) : Colors.black.withValues(alpha: .06);

TextStyle _axisStyle(BuildContext context) => TextStyle(fontSize: 10, color: _muted(context), fontWeight: FontWeight.w600);

/// "Nice" y-axis maximum and grid interval for integer counts.
(double, double) _yScale(int maxValue) {
  if (maxValue <= 0) return (4, 1);
  final step = math.max(1, (maxValue / 4).ceil()).toDouble();
  return (step * ((maxValue / step).ceil() + (maxValue % step == 0 ? 1 : 0)), step);
}

class _NoData extends StatelessWidget {
  const _NoData();

  @override
  Widget build(BuildContext context) => SizedBox(
        height: _chartHeight,
        child: Center(child: Text('No data yet', style: TextStyle(color: _muted(context)))),
      );
}

/// Two-series legend chip row.
class _Legend extends StatelessWidget {
  const _Legend(this.items);
  final List<(String, Color)> items;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 14,
        runSpacing: 6,
        children: [
          for (final (label, color) in items)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 6),
                Text(label, style: TextStyle(fontSize: 12, color: _muted(context), fontWeight: FontWeight.w600)),
              ],
            ),
        ],
      );
}

/// Grouped "leads vs converted" bar chart shared by the monthly and product
/// charts.
class _LeadsVsConvertedBars extends StatelessWidget {
  const _LeadsVsConvertedBars({required this.labels, required this.leads, required this.converted});
  final List<String> labels;
  final List<int> leads;
  final List<int> converted;

  static const _leadColor = AppColors.primary;
  static const _convColor = AppColors.secondary;

  @override
  Widget build(BuildContext context) {
    if (labels.isEmpty || leads.every((v) => v == 0)) return const _NoData();
    final (maxY, step) = _yScale([...leads, ...converted].reduce(math.max));
    final rodWidth = labels.length > 8 ? 6.0 : 10.0;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: _chartHeight,
          child: BarChart(
            BarChartData(
              maxY: maxY,
              alignment: BarChartAlignment.spaceAround,
              borderData: FlBorderData(show: false),
              gridData: FlGridData(
                drawVerticalLine: false,
                horizontalInterval: step,
                getDrawingHorizontalLine: (_) => FlLine(color: _grid(context), strokeWidth: 1),
              ),
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipColor: (_) => dark ? AppColors.surfaceDark : Colors.white,
                  getTooltipItem: (group, _, rod, rodIndex) => BarTooltipItem(
                    '${labels[group.x]}\n${rodIndex == 0 ? 'Leads' : 'Converted'}: ${rod.toY.toInt()}',
                    TextStyle(color: rod.color, fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
              ),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(),
                rightTitles: const AxisTitles(),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    interval: step,
                    getTitlesWidget: (value, meta) => SideTitleWidget(
                      meta: meta,
                      child: Text(value.toInt().toString(), style: _axisStyle(context)),
                    ),
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= labels.length) return const SizedBox.shrink();
                      // Thin out labels when crowded so they never overlap.
                      final every = (labels.length / 6).ceil();
                      if (i % every != 0) return const SizedBox.shrink();
                      return SideTitleWidget(
                        meta: meta,
                        child: SizedBox(
                          width: 56,
                          child: Text(labels[i], maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: _axisStyle(context)),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barGroups: [
                for (var i = 0; i < labels.length; i++)
                  BarChartGroupData(
                    x: i,
                    barsSpace: 3,
                    barRods: [
                      BarChartRodData(
                        toY: leads[i].toDouble(),
                        width: rodWidth,
                        color: _leadColor,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                      ),
                      BarChartRodData(
                        toY: converted[i].toDouble(),
                        width: rodWidth,
                        color: _convColor,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        const _Legend([('Leads', _leadColor), ('Converted', _convColor)]),
      ],
    );
  }
}

/// Cumulative pipeline funnel: one horizontal bar per stage, width relative
/// to the first stage.
class LeadFunnelChart extends StatelessWidget {
  const LeadFunnelChart(this.stages, {super.key});
  final List<FunnelStage> stages;

  @override
  Widget build(BuildContext context) {
    if (stages.isEmpty || stages.first.count == 0) return const _NoData();
    final top = stages.map((s) => s.count).reduce(math.max);
    final t = Theme.of(context).textTheme;
    return SizedBox(
      height: _chartHeight,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (final s in stages)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 1.5),
                child: Row(
                  children: [
                    SizedBox(
                      width: 108,
                      child: Text(s.status.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(fontSize: 11)),
                    ),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, box) {
                          final frac = top == 0 ? 0.0 : s.count / top;
                          final color = AppColors.status(s.status);
                          return Align(
                            alignment: Alignment.centerLeft,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 400),
                              width: math.max(4, box.maxWidth * frac),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(colors: [color, color.withValues(alpha: .65)]),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    SizedBox(
                      width: 34,
                      child: Text('${s.count}', textAlign: TextAlign.right, style: t.bodySmall?.copyWith(fontWeight: FontWeight.w800, fontSize: 11)),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Leads created vs converted per month.
class MonthlyPerformanceChart extends StatelessWidget {
  const MonthlyPerformanceChart(this.points, {super.key});
  final List<MonthPoint> points;

  @override
  Widget build(BuildContext context) => _LeadsVsConvertedBars(
        labels: [for (final p in points) Fmt.month(p.month)],
        leads: [for (final p in points) p.leads],
        converted: [for (final p in points) p.converted],
      );
}

/// Leads vs converted per group row (product, location, source…).
class ProductPerformanceChart extends StatelessWidget {
  const ProductPerformanceChart(this.rows, {super.key});
  final List<GroupRow> rows;

  @override
  Widget build(BuildContext context) => _LeadsVsConvertedBars(
        labels: [for (final r in rows) r.label],
        leads: [for (final r in rows) r.leads],
        converted: [for (final r in rows) r.converted],
      );
}

/// Donut of leads per status with a legend.
class StatusDistributionChart extends StatefulWidget {
  const StatusDistributionChart(this.byStatus, {super.key});
  final Map<LeadStatus, int> byStatus;

  @override
  State<StatusDistributionChart> createState() => _StatusDistributionChartState();
}

class _StatusDistributionChartState extends State<StatusDistributionChart> {
  int _touched = -1;

  @override
  Widget build(BuildContext context) {
    final entries = [
      for (final s in LeadStatus.values)
        if ((widget.byStatus[s] ?? 0) > 0) (s, widget.byStatus[s]!),
    ];
    if (entries.isEmpty) return const _NoData();
    final total = entries.fold<int>(0, (a, e) => a + e.$2);
    final t = Theme.of(context).textTheme;
    return SizedBox(
      height: _chartHeight,
      child: Row(
        children: [
          Expanded(
            flex: 5,
            child: Stack(
              alignment: Alignment.center,
              children: [
                PieChart(
                  PieChartData(
                    sectionsSpace: 2,
                    centerSpaceRadius: 36,
                    pieTouchData: PieTouchData(
                      touchCallback: (event, response) => setState(() {
                        _touched = (!event.isInterestedForInteractions || response?.touchedSection == null)
                            ? -1
                            : response!.touchedSection!.touchedSectionIndex;
                      }),
                    ),
                    sections: [
                      for (var i = 0; i < entries.length; i++)
                        PieChartSectionData(
                          value: entries[i].$2.toDouble(),
                          color: AppColors.status(entries[i].$1),
                          radius: i == _touched ? 46 : 38,
                          title: entries[i].$2 / total >= .08 ? '${entries[i].$2}' : '',
                          titleStyle: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                    ],
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$total', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    Text('leads', style: t.bodySmall?.copyWith(fontSize: 10, color: _muted(context))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 6,
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              children: [
                for (final (status, count) in entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(color: AppColors.status(status), shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(status.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(fontSize: 11)),
                        ),
                        Text('$count', style: t.bodySmall?.copyWith(fontWeight: FontWeight.w800, fontSize: 11)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Semicircular gauge for an approval rate in 0..1.
class ApprovalRateGauge extends StatelessWidget {
  const ApprovalRateGauge(this.rate, {super.key, this.label = 'Approval rate'});
  final double rate;
  final String label;

  @override
  Widget build(BuildContext context) {
    final v = rate.isNaN ? 0.0 : rate.clamp(0.0, 1.0);
    final color = v >= .6
        ? AppColors.success
        : v >= .35
            ? AppColors.warning
            : AppColors.danger;
    final t = Theme.of(context).textTheme;
    return SizedBox(
      height: _chartHeight,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = math.min(box.maxWidth, (_chartHeight - 30) * 2);
          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: w,
                height: w / 2 + 8,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: v),
                  duration: const Duration(milliseconds: 700),
                  curve: Curves.easeOutCubic,
                  builder: (context, value, _) => CustomPaint(
                    painter: _GaugePainter(value: value, color: color, track: _grid(context)),
                    child: Align(
                      alignment: const Alignment(0, .85),
                      child: Text(Fmt.percent(value), style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: color)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(label, style: t.bodySmall?.copyWith(color: _muted(context), fontWeight: FontWeight.w600)),
            ],
          );
        },
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.value, required this.color, required this.track});
  final double value;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 16.0;
    final radius = math.min(size.width / 2, size.height) - stroke / 2;
    final center = Offset(size.width / 2, size.height - 4);
    final rect = Rect.fromCircle(center: center, radius: radius);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, base..color = track.withValues(alpha: .9));
    if (value > 0) {
      canvas.drawArc(
        rect,
        math.pi,
        math.pi * value,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..shader = SweepGradient(
            startAngle: math.pi,
            endAngle: 2 * math.pi,
            colors: [color.withValues(alpha: .55), color],
          ).createShader(rect),
      );
    }
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.value != value || old.color != color || old.track != track;
}
