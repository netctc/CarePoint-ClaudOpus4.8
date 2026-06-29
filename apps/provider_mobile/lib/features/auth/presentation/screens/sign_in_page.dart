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
  String _channel = 'email';

  @override
  void initState() {
    super.initState();
    if (kDebugMode) {
      _emailController.text = 'provider@carecenter.local';
      _passwordController.text = 'ChangeMe123!';
    }
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

    if (email.isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid email address.')));
      return;
    }
    if (password.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password must be at least 8 characters.')));
      return;
    }

    try {
      await session.startChallenge(
        email: email,
        password: password,
        managedDevice: true,
        riskAcknowledged: true,
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
              padding: const EdgeInsets.fromLTRB(20, 40, 20, 24),
              children: <Widget>[
                const Icon(Icons.health_and_safety_rounded, size: 56, color: Color(0xFF1565C0)),
                const SizedBox(height: 16),
                Text('CarePoint', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.center),
                const SizedBox(height: 4),
                Text('Provider sign in', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.grey[600]), textAlign: TextAlign.center),
                const SizedBox(height: 32),
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
                      Text('Verification method', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      SegmentedButton<String>(
                        segments: const <ButtonSegment<String>>[
                          ButtonSegment<String>(value: 'email', label: Text('Email')),
                          ButtonSegment<String>(value: 'totp', label: Text('TOTP')),
                          ButtonSegment<String>(value: 'sms', label: Text('SMS')),
                        ],
                        selected: <String>{_channel},
                        onSelectionChanged: (selection) => setState(() => _channel = selection.first),
                      ),
                      if ((session.lastError ?? '').isNotEmpty) ...<Widget>[
                        const SizedBox(height: 12),
                        Text(session.lastError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 20),
                      AppPrimaryButton(
                        label: session.isBusy ? 'Signing in...' : 'Sign in',
                        icon: Icons.arrow_forward_rounded,
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
