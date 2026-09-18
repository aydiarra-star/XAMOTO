/// XAMOTO — Connexion.
///
/// Le mode démonstration est proposé explicitement : un utilisateur sans véhicule
/// doit pouvoir voir ce que XAMOTO fait, sans qu'on lui fasse croire à des
/// données réelles (§31).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../i18n/strings.dart';
import '../routes.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit({required bool demo}) async {
    final state = context.read<AppState>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final body = demo
          ? <String, Object?>{}
          : <String, Object?>{'email': _email.text.trim(), 'password': _password.text};
      final response = await state.api.post(demo ? Api.demo : Api.login, body: body);
      final token = response['token'] as String?;
      if (token == null) {
        setState(() => _error = 'Réponse inattendue du serveur.');
        return;
      }
      state.api.setToken(token);
      await state.syncNow();
      if (mounted) Navigator.pushReplacementNamed(context, Routes.home);
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
      appBar: AppBar(title: Text(i18n.t('Connexion', 'Sign in'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          Text('XAMOTO — ${i18n.t('Connaître sa voiture.', 'Know your car.')}', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(labelText: i18n.t('Adresse e-mail', 'Email address')),
          ),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: InputDecoration(labelText: i18n.t('Mot de passe', 'Password')),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : () => _submit(demo: false),
            child: Text(i18n.t('Se connecter', 'Sign in')),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _busy ? null : () => _submit(demo: true),
            child: Text(i18n.t('Découvrir avec un véhicule de démonstration', 'Explore with a demo vehicle')),
          ),
          if (_busy) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
          ErrorBox(message: _error),
          const SizedBox(height: 12),
          Text(
            i18n.t(
              'Le compte de démonstration utilise des données SIMULÉES : elles ne proviennent pas d’un véhicule réel.',
              'The demo account uses SIMULATED data: it does not come from a real vehicle.',
            ),
            style: const TextStyle(fontSize: 12),
          ),
        ],
      ),
    );
  }
}
