import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';
import '../widgets/otp_digit_box.dart';

class OtpVerificationPage extends StatefulWidget {
  const OtpVerificationPage({super.key, this.identifier});

  final String? identifier;

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  final List<TextEditingController> _controllers = List<TextEditingController>.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List<FocusNode>.generate(6, (_) => FocusNode());
  Timer? _timer;
  String? _error;
  bool _submitting = false;
  bool _resending = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
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
    for (final TextEditingController controller in _controllers) {
      controller.dispose();
    }
    for (final FocusNode node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String get _identifier => widget.identifier?.trim().isNotEmpty == true ? widget.identifier!.trim() : (AppSession.instance.pendingOtpIdentifier ?? 'patient@carecenter.local');

  int get _remainingSeconds {
    final int? resendAt = AppSession.instance.otpResendAvailableAtMs;
    if (resendAt == null) return 0;
    final int delta = resendAt - DateTime.now().millisecondsSinceEpoch;
    return delta <= 0 ? 0 : (delta / 1000).ceil();
  }

  String get _otpCode => _controllers.map((TextEditingController c) => c.text.trim()).join();

  Future<void> _verify() async {
    final l10n = context.l10n;
    if (_otpCode.length != 6) {
      setState(() => _error = l10n.t('otp.enterFullCode'));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await AppSession.instance.verifyOtp(identifier: _identifier, code: _otpCode);
      if (!mounted) return;
      context.go('/');
    } catch (error) {
      setState(() => _error = AppSession.instance.lastError ?? error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resend() async {
    if (_remainingSeconds > 0) return;
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      await AppSession.instance.resendOtp();
    } catch (error) {
      setState(() => _error = AppSession.instance.lastError ?? error.toString());
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final String timerText = _remainingSeconds > 0
        ? l10n.t('otp.timerWait', params: <String, String>{'seconds': _remainingSeconds.toString().padLeft(2, '0')})
        : l10n.t('otp.timerReady');

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: l10n.t('otp.verifyCodeTitle'),
      subtitle: l10n.t('otp.verifyCodeSubtitle', params: <String, String>{'identifier': _identifier}),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: l10n.t('otp.secureBadge'),
            title: l10n.t('otp.almostThere'),
            subtitle: l10n.t('otp.heroBody'),
          ),
          const SizedBox(height: 20),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('otp.title'), style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(timerText, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List<Widget>.generate(_controllers.length, (int index) {
                    return OtpDigitBox(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      previousFocusNode: index == 0 ? null : _focusNodes[index - 1],
                      nextFocusNode: index == _focusNodes.length - 1 ? null : _focusNodes[index + 1],
                      onCompleted: _verify,
                    );
                  }),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceTint,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: <Widget>[
                      const Icon(Icons.timer_outlined, color: AppColors.textSecondary),
                      const SizedBox(width: 12),
                      Expanded(child: Text(timerText, style: Theme.of(context).textTheme.bodyMedium)),
                      TextButton(
                        onPressed: _remainingSeconds > 0 || _resending ? null : _resend,
                        child: Text(_resending ? l10n.t('otp.sending') : l10n.t('otp.resend')),
                      ),
                    ],
                  ),
                ),
                if (AppSession.instance.lastOtpDevCode != null && AppSession.instance.lastOtpDevCode!.isNotEmpty && AppSession.instance.lastOtpDevCode != 'null') ...<Widget>[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('DEV: your code', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          AppSession.instance.lastOtpDevCode!,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: 6),
                        ),
                      ],
                    ),
                  ),
                ] else ...<Widget>[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE3F2FD),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      'devCode not available (value: ${AppSession.instance.lastOtpDevCode}). Check that API NODE_ENV=development.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
                if (_error != null) ...<Widget>[
                  const SizedBox(height: 14),
                  Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 18),
                AppPrimaryButton(
                  label: _submitting ? l10n.t('otp.verifying') : l10n.t('otp.verify'),
                  icon: Icons.arrow_forward,
                  onPressed: _submitting ? null : _verify,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
