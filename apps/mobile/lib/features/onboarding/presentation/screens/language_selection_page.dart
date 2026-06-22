import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class LanguageSelectionPage extends StatefulWidget {
  const LanguageSelectionPage({super.key});

  @override
  State<LanguageSelectionPage> createState() => _LanguageSelectionPageState();
}

class _LanguageSelectionPageState extends State<LanguageSelectionPage> {
  String _selectedLanguage = AppSession.instance.languageCode;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return PatientScaffold(
      backgroundGradient: true,
      showNavigation: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: l10n.t('language.badge'),
            title: 'CarePoint',
            subtitle: l10n.t('language.subtitle'),
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: const <Widget>[
                PatientTag(label: 'Saudi Arabia', icon: Icons.public),
                PatientTag(label: 'English & العربية', icon: Icons.translate),
              ],
            ),
          ),
          const SizedBox(height: 20),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('language.chooseTitle'), style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  l10n.t('language.chooseBody'),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                _LanguageCard(
                  title: 'English',
                  subtitle: l10n.t('language.englishSubtitle'),
                  code: 'EN',
                  selected: _selectedLanguage == 'en',
                  onTap: () => setState(() => _selectedLanguage = 'en'),
                ),
                const SizedBox(height: 12),
                _LanguageCard(
                  title: 'العربية',
                  subtitle: l10n.t('language.arabicSubtitle'),
                  code: 'AR',
                  selected: _selectedLanguage == 'ar',
                  rtl: true,
                  onTap: () => setState(() => _selectedLanguage = 'ar'),
                ),
                const SizedBox(height: 18),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceTint,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Icon(Icons.info_outline, color: AppColors.primaryDark),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          l10n.t('language.note'),
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          AppPrimaryButton(
            label: l10n.t('common.continue'),
            icon: Icons.arrow_forward,
            onPressed: () {
              AppSession.instance.setLanguage(_selectedLanguage);
              context.go('/sign-in');
            },
          ),
        ],
      ),
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
    required this.title,
    required this.subtitle,
    required this.code,
    required this.selected,
    required this.onTap,
    this.rtl = false,
  });

  final String title;
  final String subtitle;
  final String code;
  final bool selected;
  final VoidCallback onTap;
  final bool rtl;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 2 : 1),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: selected ? Colors.white : AppColors.surfaceTint,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: Text(code, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primaryDark)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: rtl ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            Icon(selected ? Icons.check_circle : Icons.radio_button_unchecked, color: selected ? AppColors.primaryDark : AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
