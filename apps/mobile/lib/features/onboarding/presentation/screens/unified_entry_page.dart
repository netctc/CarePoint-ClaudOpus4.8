import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';

class UnifiedEntryPage extends StatefulWidget {
  const UnifiedEntryPage({super.key});

  @override
  State<UnifiedEntryPage> createState() => _UnifiedEntryPageState();
}

class _UnifiedEntryPageState extends State<UnifiedEntryPage> {
  final TextEditingController _identifierController = TextEditingController(text: 'patient@carecenter.local');
  String _region = 'Saudi Arabia';
  bool _telehealthConsent = true;
  bool _dataSharingConsent = true;
  bool _notificationsConsent = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final AppSession session = AppSession.instance;
    final String identifier = _identifierController.text.trim();
    final l10n = context.l10n;
    if (identifier.isEmpty || !_telehealthConsent || !_dataSharingConsent) {
      setState(() => _error = l10n.t('entry.requiredError'));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      session.setEntryConsentDraft(
        telehealth: _telehealthConsent,
        dataSharing: _dataSharingConsent,
        notifications: _notificationsConsent,
      );
      await session.requestOtp(identifier: identifier);
      if (!mounted) return;
      context.go('/otp?identifier=${Uri.encodeQueryComponent(identifier)}');
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = session.lastError ?? error.toString());
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppSession session = AppSession.instance;
    final l10n = context.l10n;
    return PatientScaffold(
      showNavigation: false,
      backgroundGradient: true,
      title: 'CarePoint',
      subtitle: l10n.t('entry.subtitle'),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: l10n.t('entry.badge'),
            title: l10n.t('entry.title'),
            subtitle: l10n.t('entry.heroBody'),
          ),
          const SizedBox(height: 18),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('entry.languageTitle'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: <ButtonSegment<String>>[
                    ButtonSegment<String>(value: 'en', label: Text(l10n.t('entry.english'))),
                    ButtonSegment<String>(value: 'ar', label: Text(l10n.t('entry.arabic'))),
                  ],
                  selected: <String>{session.languageCode},
                  onSelectionChanged: (Set<String> value) {
                    session.setLanguage(value.first);
                    setState(() {});
                  },
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _region,
                  decoration: InputDecoration(labelText: l10n.t('entry.regionLabel')),
                  items: <DropdownMenuItem<String>>[
                    DropdownMenuItem(value: 'Saudi Arabia', child: Text(l10n.t('entry.regionSaudi'))),
                    DropdownMenuItem(value: 'GCC', child: Text(l10n.t('entry.regionGcc'))),
                    DropdownMenuItem(value: 'Other', child: Text(l10n.t('entry.regionOther'))),
                  ],
                  onChanged: (String? value) => setState(() => _region = value ?? 'Saudi Arabia'),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: l10n.t('entry.identifierLabel'),
                  hintText: l10n.t('entry.identifierHint'),
                  controller: _identifierController,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.person_outline,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('entry.consentTitle'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(l10n.t('entry.consentBody'), style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 12),
                SwitchListTile.adaptive(
                  value: _telehealthConsent,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _telehealthConsent = value),
                  title: Text(l10n.t('consent.telehealthTitle')),
                  subtitle: Text(l10n.t('consent.telehealthBody')),
                ),
                SwitchListTile.adaptive(
                  value: _dataSharingConsent,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _dataSharingConsent = value),
                  title: Text(l10n.t('consent.dataTitle')),
                  subtitle: Text(l10n.t('consent.dataBody')),
                ),
                SwitchListTile.adaptive(
                  value: _notificationsConsent,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _notificationsConsent = value),
                  title: Text(l10n.t('consent.notificationsTitle')),
                  subtitle: Text(l10n.t('consent.notificationsBody')),
                ),
              ],
            ),
          ),
          if ((_error ?? '').isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            PatientTintedCard(tint: const Color(0xFFFEE2E2), child: Text(_error!)),
          ],
          const SizedBox(height: 18),
          AppPrimaryButton(
            label: _submitting ? l10n.t('signin.submitting') : l10n.t('entry.continueToOtp'),
            icon: Icons.arrow_forward,
            onPressed: _submitting ? null : _continue,
          ),
        ],
      ),
    );
  }
}
