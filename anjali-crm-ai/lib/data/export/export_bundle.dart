import '../../domain/entities/call_log.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/followup.dart';
import '../../domain/entities/product.dart';
import '../../domain/services/report_engine.dart';

/// Everything an exporter needs, already filtered to the chosen period.
class ExportBundle {
  ExportBundle({
    required this.clients,
    required this.followups,
    required this.documents,
    required this.products,
    required this.calls,
    required this.kpis,
    required this.period,
    required this.agentName,
    required this.generatedAt,
  });

  final List<Client> clients;
  final List<Followup> followups;
  final List<ClientDocument> documents;
  final List<Product> products;
  final List<CallLog> calls;
  final KpiSummary kpis;
  final ReportPeriod period;
  final String agentName;
  final DateTime generatedAt;

  late final Map<String, String> productNames = {for (final p in products) p.id: p.name};
  late final Map<String, Client> clientById = {for (final c in clients) c.id: c};

  String productOf(Client c) => productNames[c.productId] ?? '';

  List<Client> where(bool Function(Client) f) => clients.where(f).toList();

  List<Client> get approved => where((c) => c.status == LeadStatus.approved);
  List<Client> get rejected => where((c) => c.status == LeadStatus.rejected);
  List<Client> get disbursed => where((c) => c.status == LeadStatus.disbursed);

  /// Clients in a document stage or with any required document still pending.
  List<Client> get documentsPending {
    final pendingIds = documents
        .where((d) => !d.deleted && d.type != DocumentType.custom && d.status == DocumentStatus.pending)
        .map((d) => d.clientId)
        .toSet();
    return where((c) => c.status.isOpen && (c.status.isDocumentStage || pendingIds.contains(c.id)));
  }

  List<String> pendingDocsFor(String clientId) => documents
      .where((d) => d.clientId == clientId && !d.deleted && d.status == DocumentStatus.pending)
      .map((d) => d.displayName)
      .toList();
}
