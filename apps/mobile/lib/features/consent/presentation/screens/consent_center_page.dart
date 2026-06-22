import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';

class ConsentCenterPage extends StatefulWidget {
  const ConsentCenterPage({super.key});

  @override
  State<ConsentCenterPage> createState() => _ConsentCenterPageState();
}

class _ConsentCenterPageState extends State<ConsentCenterPage> {
  late bool _telehealthConsent;
  late bool _dataSharingConsent;
  late bool _notificationsConsent;
  String? _error;

  @override
  void initState() {
    super.initState();
    final Map<String, bool> choices = AppSession.instance.consentChoices;
    _telehealthConsent = choices['telehealth'] ?? true;
    _dataSharingConsent = choices['dataSharing'] ?? true;
    _notificationsConsent = choices['notifications'] ?? true;
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    if (!_telehealthConsent || !_dataSharingConsent) {
      setState(() => _error = l10n.t('consent.requiredError'));
      return;
    }

    try {
      await AppSession.instance.saveConsent(
        telehealth: _telehealthConsent,
        dataSharing: _dataSharingConsent,
        notifications: _notificationsConsent,
      );
      if (!mounted) return;
      context.go('/home');
    } catch (error) {
      setState(() => _error = AppSession.instance.lastError ?? error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('consent.title')),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(Icons.gpp_good_outlined, color: AppColors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l10n.t('consent.hero'),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              _ConsentTile(
                value: _telehealthConsent,
                title: l10n.t('consent.telehealthTitle'),
                subtitle: l10n.t('consent.telehealthBody'),
                onChanged: (bool value) => setState(() => _telehealthConsent = value),
              ),
              const SizedBox(height: 12),
              _ConsentTile(
                value: _dataSharingConsent,
                title: l10n.t('consent.dataTitle'),
                subtitle: l10n.t('consent.dataBody'),
                onChanged: (bool value) => setState(() => _dataSharingConsent = value),
              ),
              const SizedBox(height: 12),
              _ConsentTile(
                value: _notificationsConsent,
                title: l10n.t('consent.notificationsTitle'),
                subtitle: l10n.t('consent.notificationsBody'),
                onChanged: (bool value) => setState(() => _notificationsConsent = value),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(Icons.info_outline, color: AppColors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l10n.t('consent.note'),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const Spacer(),
              AppPrimaryButton(
                label: l10n.t('common.finishSetup'),
                icon: Icons.check,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsentTile extends StatelessWidget {
  const _ConsentTile({
    required this.value,
    required this.title,
    required this.subtitle,
    required this.onChanged,
  });

  final bool value;
  final String title;
  final String subtitle;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: SwitchListTile.adaptive(
        value: value,
        onChanged: onChanged,
        contentPadding: EdgeInsets.zero,
        activeThumbColor: AppColors.primary,
        title: Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
      ),
    );
  }
}
