import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});

  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final TextEditingController _identifierController = TextEditingController(text: 'patient@carecenter.local');
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _identifierController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AppSession.instance.requestOtp(
        identifier: _identifierController.text.trim(),
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
      );
      if (!mounted) return;
      final String identifier = _identifierController.text.trim();
      context.go('/otp?identifier=${Uri.encodeComponent(identifier)}');
    } catch (error) {
      setState(() => _error = AppSession.instance.lastError ?? error.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppSession session = AppSession.instance;
    final l10n = context.l10n;

    return PatientScaffold(
      backgroundGradient: true,
      showNavigation: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: l10n.t('signin.badge'),
            title: l10n.t('signin.title'),
            subtitle: l10n.t('signin.subtitle'),
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: <Widget>[
                PatientTag(label: 'API: ${session.apiBaseUrl}', icon: Icons.cloud_done_outlined),
                PatientTag(label: session.languageCode.toUpperCase(), icon: Icons.language),
              ],
            ),
          ),
          const SizedBox(height: 20),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(child: Text(l10n.t('signin.formTitle'), style: Theme.of(context).textTheme.titleLarge)),
                    IconButton.filledTonal(
                      onPressed: () => context.go('/language'),
                      icon: const Icon(Icons.language_outlined),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(l10n.t('signin.formBody'), style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 18),
                AppTextField(
                  label: l10n.t('signin.firstNameLabel'),
                  hintText: 'Ali',
                  controller: _firstNameController,
                  keyboardType: TextInputType.name,
                  prefixIcon: Icons.person_outline,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  label: l10n.t('signin.lastNameLabel'),
                  hintText: 'Rida',
                  controller: _lastNameController,
                  keyboardType: TextInputType.name,
                  prefixIcon: Icons.person_outline,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  label: l10n.t('signin.identifierLabel'),
                  hintText: 'patient@carecenter.local',
                  controller: _identifierController,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.alternate_email,
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceTint,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(l10n.t('signin.seedTitle'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15)),
                      const SizedBox(height: 6),
                      Text('patient@carecenter.local', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(l10n.t('signin.seedBody'), style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                if (session.lastOtpDevCode != null) ...<Widget>[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text('${l10n.t('signin.devPreview')}: ${session.lastOtpDevCode}', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                  ),
                ],
                if (_error != null) ...<Widget>[
                  const SizedBox(height: 14),
                  Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 18),
                AppPrimaryButton(
                  label: _loading ? l10n.t('signin.submitting') : l10n.t('signin.submit'),
                  icon: Icons.arrow_forward,
                  onPressed: _loading ? null : _requestOtp,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
