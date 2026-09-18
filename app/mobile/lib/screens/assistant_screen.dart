/// XAMOTO — Assistant (§13, §16).
///
/// L'assistant explique, il ne diagnostique pas. Il répond dans la langue de
/// l'utilisateur quand c'est possible ; sinon il répond en français et le dit.
/// Les sources utilisées sont affichées : une explication sans source n'est pas
/// une explication, c'est une opinion.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/assistant.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final TextEditingController _question = TextEditingController();
  final List<({String question, String answer, AssistantLanguage language, List<String> sources})> _history = <({String question, String answer, AssistantLanguage language, List<String> sources})>[];
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final state = context.read<AppState>();
    final question = _question.text.trim();
    if (question.length < 2) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await state.api.post(Api.assistantAsk, body: <String, Object?>{
        'question': question,
        if (state.selectedVehicle != null) 'vehicleId': state.selectedVehicle!.id,
        if (state.lastDiagnostic != null) 'diagnosticSessionId': state.lastDiagnostic!.id,
        'locale': state.locale.locale,
      });
      final answer = AssistantAnswer.fromJson(response);
      setState(() {
        _history.insert(0, (
          question: question,
          answer: state.locale.locale == 'en' ? answer.answerEn : answer.answerFr,
          language: answer.language,
          sources: answer.sources,
        ));
        _question.clear();
      });
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final I18n i18n = context.watch<AppState>().i18n;
    return Scaffold(
      appBar: AppBar(title: Text(i18n.nav('nav.assistant'))),
      body: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                for (final entry in _history)
                  SectionCard(
                    title: entry.question,
                    subtitle: entry.language.fallback
                        ? (entry.language.noticeFr ?? i18n.t('Réponse en français.', 'Answer in French.'))
                        : null,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(entry.answer),
                        if (entry.sources.isNotEmpty) ...<Widget>[
                          const Divider(height: 18),
                          Text('${i18n.t('Sources', 'Sources')} : ${entry.sources.join(', ')}', style: const TextStyle(fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                ErrorBox(message: _error),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _question,
                      decoration: InputDecoration(
                        hintText: i18n.t('Posez votre question…', 'Ask your question…'),
                        border: const OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _ask(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _busy ? null : _ask, icon: const Icon(Icons.send)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
