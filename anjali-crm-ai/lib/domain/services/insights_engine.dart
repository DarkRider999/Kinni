import '../entities/client.dart';
import '../entities/client_document.dart';
import '../entities/enums.dart';
import '../entities/followup.dart';
import '../entities/product.dart';
import 'lead_scoring.dart';
import 'report_engine.dart';

class ScoredClient {
  const ScoredClient(this.client, this.score, this.reason);
  final Client client;
  final int score;
  final String reason;
}

/// Output of the local AI insights engine (FR-AI).
class Insights {
  const Insights({
    required this.highPriority,
    required this.longestWaiting,
    required this.overdue,
    required this.pendingDocuments,
    required this.likelyToConvert,
    required this.upcoming,
    this.bestProduct,
    this.bestSource,
    required this.scores,
  });

  final List<ScoredClient> highPriority;
  final List<ScoredClient> longestWaiting;
  final List<ScoredClient> overdue;
  final List<ScoredClient> pendingDocuments;
  final List<ScoredClient> likelyToConvert;
  final List<ScoredClient> upcoming;
  final GroupRow? bestProduct;
  final GroupRow? bestSource;
  final Map<String, int> scores;

  static const empty = Insights(
      highPriority: [], longestWaiting: [], overdue: [], pendingDocuments: [], likelyToConvert: [], upcoming: [], scores: {});
}

abstract final class InsightsEngine {
  static Insights build({
    required List<Client> clients,
    required List<Followup> followups,
    required List<ClientDocument> documents,
    required List<Product> products,
    required DateTime now,
    int limit = 5,
  }) {
    final live = clients.where((c) => !c.deleted).toList();
    final fuBy = <String, List<Followup>>{};
    for (final f in followups.where((f) => !f.deleted)) {
      fuBy.putIfAbsent(f.clientId, () => []).add(f);
    }
    final docBy = <String, List<ClientDocument>>{};
    for (final d in documents.where((d) => !d.deleted)) {
      docBy.putIfAbsent(d.clientId, () => []).add(d);
    }
    final scores = {
      for (final c in live) c.id: LeadScoring.score(c, followups: fuBy[c.id] ?? const [], docs: docBy[c.id] ?? const [], now: now),
    };
    final open = live.where((c) => c.status.isOpen).toList();

    List<ScoredClient> top(Iterable<Client> src, int Function(Client a, Client b) cmp, String Function(Client) why) {
      final l = src.toList()..sort(cmp);
      return l.take(limit).map((c) => ScoredClient(c, scores[c.id] ?? 0, why(c))).toList();
    }

    final highPriority = top(
      open.where((c) => c.priority.index >= Priority.high.index || (scores[c.id] ?? 0) >= 70),
      (a, b) => (scores[b.id] ?? 0).compareTo(scores[a.id] ?? 0),
      (c) => '${c.priority.label} priority · score ${scores[c.id]}',
    );

    final longestWaiting = top(
      open,
      (a, b) => a.statusChangedAt.compareTo(b.statusChangedAt),
      (c) => 'In "${c.status.label}" for ${now.difference(c.statusChangedAt).inDays} days',
    );

    final overdueIds = <String, Followup>{};
    for (final f in followups.where((f) => !f.deleted && f.isOverdue(now))) {
      final cur = overdueIds[f.clientId];
      if (cur == null || f.dueAt.isBefore(cur.dueAt)) overdueIds[f.clientId] = f;
    }
    final overdue = top(
      live.where((c) => overdueIds.containsKey(c.id)),
      (a, b) => overdueIds[a.id]!.dueAt.compareTo(overdueIds[b.id]!.dueAt),
      (c) => 'Followup overdue by ${_ago(now.difference(overdueIds[c.id]!.dueAt))}',
    );

    final pendingDocs = top(
      open.where((c) {
        final d = docBy[c.id] ?? const [];
        return c.status.isDocumentStage || d.any((x) => x.status == DocumentStatus.pending && x.type != DocumentType.custom);
      }),
      (a, b) => (scores[b.id] ?? 0).compareTo(scores[a.id] ?? 0),
      (c) {
        final n = (docBy[c.id] ?? const []).where((x) => x.status == DocumentStatus.pending && x.type != DocumentType.custom).length;
        return n > 0 ? '$n document${n == 1 ? '' : 's'} pending' : 'Waiting for documents';
      },
    );

    final likely = top(
      open.where((c) => c.status.pipelineIndex >= LeadStatus.interested.pipelineIndex && (scores[c.id] ?? 0) >= 55),
      (a, b) => (scores[b.id] ?? 0).compareTo(scores[a.id] ?? 0),
      (c) => '${LeadScoring.band(scores[c.id] ?? 0)} lead · ${c.status.label}',
    );

    final nextWeek = now.add(const Duration(days: 7));
    final upcomingIds = <String, Followup>{};
    for (final f in followups.where((f) => !f.deleted && f.isPending && f.dueAt.isAfter(now) && f.dueAt.isBefore(nextWeek))) {
      final cur = upcomingIds[f.clientId];
      if (cur == null || f.dueAt.isBefore(cur.dueAt)) upcomingIds[f.clientId] = f;
    }
    final upcoming = top(
      open.where((c) => upcomingIds.containsKey(c.id) && (scores[c.id] ?? 0) >= 60),
      (a, b) => upcomingIds[a.id]!.dueAt.compareTo(upcomingIds[b.id]!.dueAt),
      (c) => 'Followup ${_in(upcomingIds[c.id]!.dueAt.difference(now))} · score ${scores[c.id]}',
    );

    GroupRow? best(ReportGroup g) {
      final rows = ReportEngine.groupBy(g, live, products).where((r) => r.leads >= 2 && r.label != 'No product').toList();
      if (rows.isEmpty) return null;
      rows.sort((a, b) {
        final r = b.conversionRate.compareTo(a.conversionRate);
        return r != 0 ? r : b.converted.compareTo(a.converted);
      });
      return rows.first.converted == 0 ? null : rows.first;
    }

    return Insights(
      highPriority: highPriority,
      longestWaiting: longestWaiting,
      overdue: overdue,
      pendingDocuments: pendingDocs,
      likelyToConvert: likely,
      upcoming: upcoming,
      bestProduct: best(ReportGroup.product),
      bestSource: best(ReportGroup.source),
      scores: scores,
    );
  }

  static String _ago(Duration d) => d.inDays >= 1 ? '${d.inDays} d' : d.inHours >= 1 ? '${d.inHours} h' : '${d.inMinutes} min';
  static String _in(Duration d) => d.inDays >= 1 ? 'in ${d.inDays} d' : 'in ${d.inHours} h';
}
