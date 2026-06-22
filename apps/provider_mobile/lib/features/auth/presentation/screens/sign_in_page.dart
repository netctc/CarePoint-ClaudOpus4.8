import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/provider_ui.dart';

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});

  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _managedDevice = true;
  bool _riskAcknowledged = true;
  String _channel = 'totp';

  @override
  void initState() {
    super.initState();
    if (kDebugMode) {
      _emailController.text = 'provider@carecenter.local';
      _passwordController.text = 'ChangeMe123!';
    }
  }

  bool _looksLikeEmail(String value) {
    final RegExp emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    return emailPattern.hasMatch(value.trim());
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final ProviderSession session = ProviderSession.instance;
    final String email = _emailController.text.trim();
    final String password = _passwordController.text;

    if (!_looksLikeEmail(email)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid work email address.')));
      return;
    }
    if (password.trim().length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password must be at least 8 characters.')));
      return;
    }

    try {
      await session.startChallenge(
        email: email,
        password: password,
        managedDevice: _managedDevice,
        riskAcknowledged: _riskAcknowledged,
        channel: _channel,
      );
      if (!mounted) return;
      context.go('/otp');
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final ProviderSession session = ProviderSession.instance;
    return Scaffold(
      body: SafeArea(
        child: AnimatedBuilder(
          animation: session,
          builder: (context, _) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
              children: <Widget>[
                Text('Provider sign in', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                Text('Use your provider work email and password. This flow uses the existing privileged challenge endpoints in the service API.', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),
                const ProviderHeroCard(
                  title: 'Secure privileged access',
                  subtitle: 'Managed device checks, second-factor challenge, and role-aware access are preserved for mobile.',
                  badge: 'Healthcare security',
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      AppTextField(
                        label: 'Work email',
                        hintText: 'provider@carecenter.local',
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        prefixIcon: Icons.mail_outline_rounded,
                      ),
                      const SizedBox(height: 16),
                      AppTextField(
                        label: 'Password',
                        hintText: 'Enter your password',
                        controller: _passwordController,
                        obscureText: true,
                        prefixIcon: Icons.lock_outline_rounded,
                      ),
                      const SizedBox(height: 16),
                      Text('Challenge channel', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      SegmentedButton<String>(
                        segments: const <ButtonSegment<String>>[
                          ButtonSegment<String>(value: 'totp', label: Text('TOTP')),
                          ButtonSegment<String>(value: 'email', label: Text('Email')),
                          ButtonSegment<String>(value: 'sms', label: Text('SMS')),
                        ],
                        selected: <String>{_channel},
                        onSelectionChanged: (selection) => setState(() => _channel = selection.first),
                      ),
                      const SizedBox(height: 16),
                      SwitchListTile.adaptive(
                        value: _managedDevice,
                        onChanged: (value) => setState(() => _managedDevice = value),
                        title: const Text('Managed device'),
                        subtitle: const Text('Mark this phone as a managed work device.'),
                        contentPadding: EdgeInsets.zero,
                      ),
                      SwitchListTile.adaptive(
                        value: _riskAcknowledged,
                        onChanged: (value) => setState(() => _riskAcknowledged = value),
                        title: const Text('Risk acknowledged'),
                        subtitle: const Text('Required when additional challenge signals are triggered.'),
                        contentPadding: EdgeInsets.zero,
                      ),
                      if ((session.lastError ?? '').isNotEmpty) ...<Widget>[
                        const SizedBox(height: 8),
                        Text(session.lastError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 16),
                      AppPrimaryButton(
                        label: session.isBusy ? 'Starting challenge...' : 'Start sign in challenge',
                        icon: Icons.shield_moon_rounded,
                        onPressed: session.isBusy ? null : _submit,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
