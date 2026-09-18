/// XAMOTO — File de synchronisation et conflits (§32).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:xamoto_mobile/storage/sync_queue.dart';

void main() {
  group('règles de conflit', () {
    test('une observation de l’utilisateur ne se perd pas', () {
      expect(policyFor(PendingKind.observation), ConflictPolicy.localWins);
    });

    test('une conclusion du serveur n’est pas écrasée localement', () {
      expect(policyFor(PendingKind.computation), ConflictPolicy.serverWins);
    });

    test('un partage en désaccord est remonté à l’utilisateur', () {
      expect(policyFor(PendingKind.share), ConflictPolicy.askUser);
    });
  });

  group('nouveaux essais', () {
    test('le délai augmente sans jamais devenir infini', () {
      Duration delayFor(int attempts) => PendingOperation(
            id: 1,
            kind: PendingKind.observation,
            opKey: 'test',
            path: '/api/scans',
            payload: const <String, Object?>{},
            createdAt: DateTime.now(),
            attempts: attempts,
          ).nextAttemptDelay;

      expect(delayFor(0).inSeconds, greaterThanOrEqualTo(1));
      expect(delayFor(3).inSeconds, greaterThan(delayFor(1).inSeconds));
      expect(delayFor(20).inSeconds, lessThanOrEqualTo(SyncPolicy.maxDelay.inSeconds));
    });

    test('une opération cesse d’être retentée après le nombre maximal d’essais', () {
      PendingOperation operation(int attempts) => PendingOperation(
            id: 1,
            kind: PendingKind.observation,
            opKey: 'test',
            path: '/api/scans',
            payload: const <String, Object?>{},
            createdAt: DateTime.now(),
            attempts: attempts,
          );
      expect(operation(0).isRetryable, isTrue);
      expect(operation(SyncPolicy.maxAttempts).isRetryable, isFalse);
    });
  });
}
