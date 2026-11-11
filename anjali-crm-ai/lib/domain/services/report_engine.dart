import '../../core/utils/date_utils.dart';
import '../entities/client.dart';
import '../entities/enums.dart';
import '../entities/followup.dart';
import '../entities/product.dart';

/// Headline KPIs for the dashboard and reports.
class KpiSummary {
  const KpiSummary({
    required this.total,
    required this.byStatus,
    required this.approvalRate,
    required this.rejectionRate,
    required this.conversionRate,
    required this.avgFollowups,
    required this.followupsToday,
    required this.overdueFollowups,
    required this.monthlyConversions,
    required this.disbursedAmount,
    required this.documentsPending,
  });

  final int total;
  final Map<LeadStatus, int> byStatus;
  final double approvalRate;
  final double rejectionRate;
  final double conversionRate;
  final double avgFollowups;
  final int followupsToday;
  final int overdueFollowups;
  final int monthlyConversions;
  final double disbursedAmount;
  final int documentsPending;

  int count(LeadStatus s) => byStatus[s] ?? 0;
}

enum ReportGroup {
  month('Month'),
  product('Product'),
  status('Status'),
  location('Location'),
  salary('Salary Range'),
  source('Lead Source');

  const ReportGroup(this.label);
  final String label;
}

/// One row of a grouped report.
class GroupRow {
  const GroupRow({required this.label, required this.leads, required this.converted, required this.rejected, required this.disbursed, this.sortKey = 0});
  final String label;
  final int leads;
  final int converted;
  final int rejected;
  final double disbursed;
  final num sortKey;
  double get conversionRate => leads == 0 ? 0 : converted / leads;
}

class FunnelStage {
  const FunnelStage(this.status, this.count);
  final LeadStatus status;
  final int count;
}

class MonthPoint {
  const MonthPoint(this.month, this.leads, this.converted);
  final DateTime month;
  final int leads;
  final int converted;
}

/// Reporting period filter.
enum ReportPeriod {
  thisMonth('This month'),
  last3Months('Last 3 months'),
  thisYear('This year'),
  all('All time');

  const ReportPeriod(this.label);
  final String label;

  DateTime? start(DateTime now) => switch (this) {
        ReportPeriod.thisMonth => DateX.startOfMonth(now),
        ReportPeriod.last3Months => DateTime(now.year, now.month - 2),
        ReportPeriod.thisYear => DateTime(now.year),
        ReportPeriod.all => null,
      };
}

/// Pure aggregation over clients and followups.
abstract final class ReportEngine {
  static List<Client> inPeriod(List<Client> clients, ReportPeriod p, DateTime now) {
    final s = p.start(now);
    return clients.where((c) => !c.deleted && (s == null || !c.createdAt.isBefore(s))).toList();
  }

  static KpiSummary kpis(List<Client> clients, List<Followup> followups, {required DateTime now, Set<String> clientsWithPendingDocs = const {}}) {
    final live = clients.where((c) => !c.deleted).toList();
    final byStatus = {for (final s in LeadStatus.values) s: 0};
    for (final c in live) {
      byStatus[c.status] = byStatus[c.status]! + 1;
    }
    final converted = byStatus[LeadStatus.approved]! + byStatus[LeadStatus.disbursed]!;
    final decided = converted + byStatus[LeadStatus.rejected]! + byStatus[LeadStatus.notEligible]!;
    final liveIds = live.map((c) => c.id).toSet();
    final fu = followups.where((f) => !f.deleted && liveIds.contains(f.clientId)).toList();
    final completed = fu.where((f) => f.status == FollowupStatus.completed).length;
    final withFollowups = fu.map((f) => f.clientId).toSet().length;
    final pending = fu.where((f) => f.isPending);
    final docsPending = live
        .where((c) => c.status.isDocumentStage || (c.status.isOpen && clientsWithPendingDocs.contains(c.id)))
        .length;
    return KpiSummary(
      total: live.length,
      byStatus: byStatus,
      approvalRate: decided == 0 ? 0 : converted / decided,
      rejectionRate: decided == 0 ? 0 : byStatus[LeadStatus.rejected]! / decided,
      conversionRate: live.isEmpty ? 0 : converted / live.length,
      avgFollowups: withFollowups == 0 ? 0 : completed / withFollowups,
      followupsToday: pending.where((f) => DateX.sameDay(f.dueAt, now) && !f.dueAt.isBefore(now)).length,
      overdueFollowups: pending.where((f) => f.dueAt.isBefore(now)).length,
      monthlyConversions: live.where((c) => c.status.isConverted && DateX.sameMonth(c.statusChangedAt, now)).length,
      disbursedAmount: live.where((c) => c.status == LeadStatus.disbursed).fold(0.0, (a, c) => a + (c.disbursedAmount ?? c.approvedAmount ?? 0)),
      documentsPending: docsPending,
    );
  }

  static List<FunnelStage> funnel(List<Client> clients) {
    // A lead counts at every stage it has reached (cumulative funnel).
    final live = clients.where((c) => !c.deleted && !c.status.isClosedLost).toList();
    return [
      for (final s in LeadStatus.pipeline)
        FunnelStage(s, live.where((c) => c.status.pipelineIndex >= s.pipelineIndex).length),
    ];
  }

  static List<MonthPoint> monthly(List<Client> clients, DateTime now, {int months = 6}) {
    final live = clients.where((c) => !c.deleted).toList();
    return [
      for (var i = months - 1; i >= 0; i--)
        () {
          final m = DateTime(now.year, now.month - i);
          return MonthPoint(
            m,
            live.where((c) => DateX.sameMonth(c.createdAt, m)).length,
            live.where((c) => c.status.isConverted && DateX.sameMonth(c.statusChangedAt, m)).length,
          );
        }(),
    ];
  }

  static String salaryBand(double? s) {
    if (s == null) return 'Unknown';
    if (s < 5000) return '< 5k';
    if (s < 10000) return '5k – 10k';
    if (s < 20000) return '10k – 20k';
    if (s < 35000) return '20k – 35k';
    return '35k +';
  }

  static int _salaryOrder(String band) => const ['< 5k', '5k – 10k', '10k – 20k', '20k – 35k', '35k +', 'Unknown'].indexOf(band);

  static List<GroupRow> groupBy(ReportGroup g, List<Client> clients, List<Product> products) {
    final productNames = {for (final p in products) p.id: p.name};
    final groups = <String, List<Client>>{};
    final sortKeys = <String, num>{};
    for (final c in clients.where((c) => !c.deleted)) {
      late String key;
      num sk = 0;
      switch (g) {
        case ReportGroup.month:
          final m = DateX.startOfMonth(c.createdAt);
          key = '${m.year}-${m.month.toString().padLeft(2, '0')}';
          sk = m.millisecondsSinceEpoch;
        case ReportGroup.product:
          key = productNames[c.productId] ?? 'No product';
        case ReportGroup.status:
          key = c.status.label;
          sk = c.status.index;
        case ReportGroup.location:
          key = (c.location == null || c.location!.trim().isEmpty) ? 'Unknown' : c.location!.trim();
        case ReportGroup.salary:
          key = salaryBand(c.monthlySalary);
          sk = _salaryOrder(key);
        case ReportGroup.source:
          key = c.leadSource.label;
      }
      groups.putIfAbsent(key, () => []).add(c);
      sortKeys[key] = sk;
    }
    final rows = [
      for (final e in groups.entries)
        GroupRow(
          label: e.key,
          leads: e.value.length,
          converted: e.value.where((c) => c.status.isConverted).length,
          rejected: e.value.where((c) => c.status == LeadStatus.rejected).length,
          disbursed: e.value.where((c) => c.status == LeadStatus.disbursed).fold(0.0, (a, c) => a + (c.disbursedAmount ?? 0)),
          sortKey: sortKeys[e.key]!,
        ),
    ];
    if (g == ReportGroup.month || g == ReportGroup.status || g == ReportGroup.salary) {
      rows.sort((a, b) => a.sortKey.compareTo(b.sortKey));
    } else {
      rows.sort((a, b) => b.leads.compareTo(a.leads));
    }
    return rows;
  }
}
