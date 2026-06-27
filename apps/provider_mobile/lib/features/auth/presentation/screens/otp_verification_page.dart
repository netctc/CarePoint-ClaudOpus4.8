import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/provider_ui.dart';
import '../widgets/otp_digit_box.dart';

class OtpVerificationPage extends StatefulWidget {
  const OtpVerificationPage({super.key});

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  final List<TextEditingController> _controllers = List<TextEditingController>.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List<FocusNode>.generate(6, (_) => FocusNode());
  Timer? _timer;
  int _remainingSeconds = 60;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_remainingSeconds > 0) {
        setState(() => _remainingSeconds--);
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _focusNodes.isNotEmpty) {
        _focusNodes.first.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text.trim()).join();

  Future<void> _verify() async {
    if (_code.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter the full 6-digit code.')));
      return;
    }
    final ProviderSession session = ProviderSession.instance;
    try {
      await session.verifyChallenge(_code);
      if (!context.mounted) return;
      context.go('/dashboard');
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _resend() async {
    if (_remainingSeconds > 0) return;
    final ProviderSession session = ProviderSession.instance;
    try {
      await session.resendChallenge();
      setState(() => _remainingSeconds = 60);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code resent.')));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final ProviderSession session = ProviderSession.instance;
    final String timerText = _remainingSeconds > 0
        ? 'Resend in 00:${_remainingSeconds.toString().padLeft(2, '0')}'
        : 'You can resend now.';

    return Scaffold(
      body: SafeArea(
        child: AnimatedBuilder(
          animation: session,
          builder: (context, _) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 40, 20, 24),
              children: <Widget>[
                const Icon(Icons.verified_user_outlined, size: 48, color: Color(0xFF1565C0)),
                const SizedBox(height: 16),
                Text('Verification code', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(
                  'Enter the 6-digit code sent to ${session.pendingEmail ?? 'your email'}.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                // DEV code display
                if ((session.lastOtpDevCode ?? '').isNotEmpty) ...<Widget>[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: <Widget>[
                        Text('DEV: your code', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600])),
                        const SizedBox(height: 4),
                        Text(
                          session.lastOtpDevCode!,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: 6),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                // 6 digit boxes
                ProviderCard(
                  child: Column(
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List<Widget>.generate(6, (int index) {
                          return OtpDigitBox(
                            controller: _controllers[index],
                            focusNode: _focusNodes[index],
                            previousFocusNode: index == 0 ? null : _focusNodes[index - 1],
                            nextFocusNode: index == 5 ? null : _focusNodes[index + 1],
                            onCompleted: _verify,
                          );
                        }),
                      ),
                      const SizedBox(height: 18),
                      // Timer + resend
                      Row(
                        children: <Widget>[
                          Icon(Icons.timer_outlined, size: 18, color: Colors.grey[500]),
                          const SizedBox(width: 8),
                          Expanded(child: Text(timerText, style: Theme.of(context).textTheme.bodySmall)),
                          TextButton(
                            onPressed: _remainingSeconds > 0 || session.isBusy ? null : _resend,
                            child: const Text('Resend'),
                          ),
                        ],
                      ),
                      if ((session.lastError ?? '').isNotEmpty) ...<Widget>[
                        const SizedBox(height: 8),
                        Text(session.lastError!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
                      ],
                      const SizedBox(height: 16),
                      AppPrimaryButton(
                        label: session.isBusy ? 'Verifying...' : 'Verify and continue',
                        icon: Icons.check_circle_outline_rounded,
                        onPressed: session.isBusy ? null : _verify,
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
