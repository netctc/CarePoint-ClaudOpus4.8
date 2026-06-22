import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/provider_ui.dart';

class OtpVerificationPage extends StatefulWidget {
  const OtpVerificationPage({super.key});

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  final TextEditingController _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final ProviderSession session = ProviderSession.instance;
    try {
      await session.verifyChallenge(_codeController.text.trim());
      if (!context.mounted) return;
      context.go('/dashboard');
    } catch (error) {
      if (!context.mounted) return;
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
                Text('Verify challenge', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                Text('Enter the verification code for ${session.pendingEmail ?? 'your account'}.', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if ((session.lastOtpDevCode ?? '').isNotEmpty)
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text('Development code: ${session.lastOtpDevCode}', style: Theme.of(context).textTheme.titleMedium),
                        ),
                      if ((session.lastOtpDevCode ?? '').isNotEmpty) const SizedBox(height: 16),
                      AppTextField(
                        label: 'Verification code',
                        hintText: '123456',
                        controller: _codeController,
                        keyboardType: TextInputType.number,
                        prefixIcon: Icons.verified_user_outlined,
                      ),
                      if ((session.lastError ?? '').isNotEmpty) ...<Widget>[
                        const SizedBox(height: 8),
                        Text(session.lastError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 16),
                      AppPrimaryButton(
                        label: session.isBusy ? 'Verifying...' : 'Verify and continue',
                        icon: Icons.check_circle_outline_rounded,
                        onPressed: session.isBusy ? null : _verify,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: session.isBusy
                            ? null
                            : () async {
                                try {
                                  await session.resendChallenge();
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Challenge resent.')));
                                } catch (error) {
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
                                }
                              },
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Resend code'),
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
