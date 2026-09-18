/// XAMOTO — File de synchronisation et règles de conflit (§32).
///
/// Le mobile est « local d'abord » : une observation est enregistrée sur le
/// téléphone, puis envoyée au serveur quand le réseau revient. Ces règles sont
/// écrites ici, en clair, parce qu'elles décident de ce qui gagne en cas de
/// désaccord — et qu'une règle implicite se transforme toujours en perte de
/// données.
library;

enum PendingKind {
  /// Observation de l'utilisateur (symptôme, résultat de test, kilométrage).
  observation,

  /// Demande de calcul adressée au serveur (scan, diagnostic).
  computation,

  /// Partage ou envoi (rapport, devis) — jamais silencieux, jamais rétroactif.
  share,
}

/// Qui gagne quand les deux côtés ont changé la même chose.
enum ConflictPolicy {
  /// L'utilisateur a vu quelque chose : son observation ne se perd pas.
  localWins,

  /// Une conclusion vient du moteur : on ne réécrit pas un calcul par un état local.
  serverWins,

  /// Deux versions incompatibles : XAMOTO ne choisit pas à la place de l'utilisateur.
  askUser,
}

ConflictPolicy policyFor(PendingKind kind) => switch (kind) {
      PendingKind.observation => ConflictPolicy.localWins,
      PendingKind.computation => ConflictPolicy.serverWins,
      PendingKind.share => ConflictPolicy.askUser,
    };

class PendingOperation {
  const PendingOperation({
    required this.id,
    required this.kind,
    required this.opKey,
    required this.path,
    required this.payload,
    required this.createdAt,
    required this.attempts,
    this.vehicleId,
    this.lastError,
  });

  final int id;
  final PendingKind kind;

  /// Clé logique : deux observations identiques ne sont pas envoyées deux fois.
  final String opKey;
  final String path;
  final Map<String, Object?> payload;
  final DateTime createdAt;
  final int attempts;
  final String? vehicleId;
  final String? lastError;

  bool get isRetryable => attempts < SyncPolicy.maxAttempts;

  /// Délai avant nouvel essai : on n'insiste pas toutes les secondes, et on
  /// n'abandonne jamais un envoi au bout d'un seul échec réseau.
  Duration get nextAttemptDelay {
    final base = SyncPolicy.baseDelay.inSeconds * (1 << attempts.clamp(0, 5));
    return Duration(seconds: base.clamp(1, SyncPolicy.maxDelay.inSeconds));
  }
}

abstract final class SyncPolicy {
  static const int maxAttempts = 8;
  static const Duration baseDelay = Duration(seconds: 5);
  static const Duration maxDelay = Duration(minutes: 30);

  /// Une donnée du serveur plus vieille que ce délai est affichée comme « datée ».
  static const Duration staleAfter = Duration(hours: 12);
}

/// Résultat d'une synchronisation, tel qu'il est montré à l'utilisateur.
class SyncReport {
  const SyncReport({
    required this.sent,
    required this.failed,
    required this.pulled,
    required this.conflicts,
    this.offline = false,
  });

  final int sent;
  final int failed;
  final int pulled;
  final List<String> conflicts;
  final bool offline;

  String get summaryFr => offline
      ? 'Hors ligne : $sent opération(s) en attente, aucune donnée perdue.'
      : 'Synchronisé : $sent envoyée(s), $pulled reçue(s)${failed > 0 ? ', $failed en échec' : ''}.';

  String get summaryEn => offline
      ? 'Offline: $sent operation(s) queued, no data lost.'
      : 'Synced: $sent sent, $pulled received${failed > 0 ? ', $failed failed' : ''}.';
}
