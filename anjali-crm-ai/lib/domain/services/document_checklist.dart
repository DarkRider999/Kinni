import '../entities/client_document.dart';
import '../entities/document_category.dart';
import '../entities/enums.dart';
import '../entities/product.dart';

/// One line of a product's required-document checklist.
class ChecklistItem {
  const ChecklistItem(this.categoryId, this.status, {this.document});
  final String categoryId;

  /// Best status among the client's documents in this category
  /// (Pending when nothing exists yet).
  final DocumentStatus status;
  final ClientDocument? document;
  bool get done => status.isCollected;
}

class DocumentChecklist {
  const DocumentChecklist(this.items);
  final List<ChecklistItem> items;

  int get completed => items.where((i) => i.done).length;
  double get completion => items.isEmpty ? 1 : completed / items.length;
  bool get isComplete => completed == items.length;
  bool get hasRequested => items.any((i) => i.status == DocumentStatus.requested);
  int get missing => items.length - completed;

  /// Used when a product has no checklist of its own.
  static const fallbackRequired = [
    DocumentCategory.passport,
    DocumentCategory.emiratesIdFront,
    DocumentCategory.emiratesIdBack,
    DocumentCategory.visa,
    DocumentCategory.salaryCertificate,
    DocumentCategory.bankStatement,
  ];

  /// Ranking used to pick the "best" document in a category.
  static int _rank(ClientDocument d) => switch (d.status) {
        DocumentStatus.verified => 6,
        DocumentStatus.received => 5,
        DocumentStatus.requested => 4,
        DocumentStatus.rejected => 3,
        DocumentStatus.expired => 2,
        DocumentStatus.pending => 1,
      };

  static DocumentChecklist build(Product? product, Iterable<ClientDocument> clientDocs) {
    final required = (product == null || product.requiredCategoryIds.isEmpty) ? fallbackRequired : product.requiredCategoryIds;
    final live = clientDocs.where((d) => !d.deleted).toList();
    return DocumentChecklist([
      for (final cat in required)
        () {
          final inCat = live.where((d) => d.categoryId == cat).toList()..sort((a, b) => _rank(b).compareTo(_rank(a)));
          if (inCat.isEmpty) return ChecklistItem(cat, DocumentStatus.pending);
          final best = inCat.first;
          return ChecklistItem(cat, best.status, document: best);
        }(),
    ]);
  }
}

/// Expiry reminder schedule (days before expiry).
abstract final class DocumentExpiry {
  static const reminderDays = [30, 15, 7, 1];

  static bool isExpired(ClientDocument d, DateTime now) => (d.daysToExpiry(now) ?? 1) < 0;

  /// Documents expiring within [withinDays] (not yet expired).
  static List<ClientDocument> expiringSoon(Iterable<ClientDocument> docs, DateTime now, {int withinDays = 30}) => docs
      .where((d) => !d.deleted && d.expiryDate != null && d.daysToExpiry(now)! >= 0 && d.daysToExpiry(now)! <= withinDays)
      .toList()
    ..sort((a, b) => a.expiryDate!.compareTo(b.expiryDate!));
}
