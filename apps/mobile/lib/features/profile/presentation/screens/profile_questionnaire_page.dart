import 'package:flutter/material.dart';

import '../../../../core/localization/app_localizations.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';

class ProfileQuestionnairePage extends StatefulWidget {
  const ProfileQuestionnairePage({required this.initialQuestionnaire, super.key});

  final Map<String, dynamic> initialQuestionnaire;

  @override
  State<ProfileQuestionnairePage> createState() => _ProfileQuestionnairePageState();
}

class _ProfileQuestionnairePageState extends State<ProfileQuestionnairePage> {
  static const List<String> _smokingOptions = <String>['Never', 'Former', 'Current', 'Prefer not to say'];
  static const List<String> _pregnancyOptions = <String>['Not applicable', 'Pregnant', 'Planning', 'Prefer not to say'];

  final TextEditingController _heightController = TextEditingController();
  final TextEditingController _weightController = TextEditingController();
  final TextEditingController _bloodTypeController = TextEditingController();
  final TextEditingController _allergiesController = TextEditingController();
  final TextEditingController _conditionsController = TextEditingController();
  final TextEditingController _medicationsController = TextEditingController();
  final TextEditingController _surgeriesController = TextEditingController();
  final TextEditingController _emergencyNotesController = TextEditingController();

  String _smokingStatus = 'Never';
  String _pregnancyStatus = 'Not applicable';
  String? _error;

  @override
  void initState() {
    super.initState();
    final Map<String, dynamic> q = widget.initialQuestionnaire;
    _heightController.text = q['heightCm']?.toString() ?? '';
    _weightController.text = q['weightKg']?.toString() ?? '';
    _bloodTypeController.text = q['bloodType']?.toString() ?? '';
    _allergiesController.text = q['allergies']?.toString() ?? '';
    _conditionsController.text = q['chronicConditions']?.toString() ?? '';
    _medicationsController.text = q['currentMedications']?.toString() ?? '';
    _surgeriesController.text = q['pastSurgeries']?.toString() ?? '';
    _emergencyNotesController.text = q['emergencyNotes']?.toString() ?? '';
    _smokingStatus = _normalizeChoice(q['smokingStatus'], _smokingOptions, 'Never');
    _pregnancyStatus = _normalizeChoice(q['pregnancyStatus'], _pregnancyOptions, 'Not applicable');
  }

  @override
  void dispose() {
    _heightController.dispose();
    _weightController.dispose();
    _bloodTypeController.dispose();
    _allergiesController.dispose();
    _conditionsController.dispose();
    _medicationsController.dispose();
    _surgeriesController.dispose();
    _emergencyNotesController.dispose();
    super.dispose();
  }

  String _normalizeChoice(dynamic rawValue, List<String> supported, String fallback) {
    final String value = rawValue?.toString().trim() ?? '';
    if (value.isEmpty) {
      return fallback;
    }
    for (final String option in supported) {
      if (option.toLowerCase() == value.toLowerCase()) {
        return option;
      }
    }
    return fallback;
  }

  double? _parsePositiveNumber(String input) {
    final String normalized = input.trim().replaceAll(',', '.');
    if (normalized.isEmpty) {
      return null;
    }
    final double? value = double.tryParse(normalized);
    if (value == null || value <= 0) {
      return null;
    }
    return value;
  }

  String? _validate(AppLocalizations l10n) {
    final String height = _heightController.text.trim();
    final String weight = _weightController.text.trim();
    if (height.isNotEmpty && _parsePositiveNumber(height) == null) {
      return l10n.t('profile.heightValidationError');
    }
    if (weight.isNotEmpty && _parsePositiveNumber(weight) == null) {
      return l10n.t('profile.weightValidationError');
    }
    return null;
  }

  Map<String, dynamic> _buildPayload() {
    return <String, dynamic>{
      'bloodType': _bloodTypeController.text.trim(),
      'allergies': _allergiesController.text.trim(),
      'chronicConditions': _conditionsController.text.trim(),
      'currentMedications': _medicationsController.text.trim(),
      'pastSurgeries': _surgeriesController.text.trim(),
      'heightCm': _heightController.text.trim(),
      'weightKg': _weightController.text.trim(),
      'smokingStatus': _smokingStatus,
      'pregnancyStatus': _pregnancyStatus,
      'emergencyNotes': _emergencyNotesController.text.trim(),
    };
  }

  void _save() {
    final AppLocalizations l10n = context.l10n;
    final String? error = _validate(l10n);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    Navigator.of(context).pop<Map<String, dynamic>>(_buildPayload());
  }

  String _smokingLabel(BuildContext context, String value) {
    switch (value) {
      case 'Former':
        return context.l10n.t('profile.smokingFormer');
      case 'Current':
        return context.l10n.t('profile.smokingCurrent');
      case 'Prefer not to say':
        return context.l10n.t('profile.preferNotToSay');
      case 'Never':
      default:
        return context.l10n.t('profile.smokingNever');
    }
  }

  String _pregnancyLabel(BuildContext context, String value) {
    switch (value) {
      case 'Pregnant':
        return context.l10n.t('profile.pregnancyPregnant');
      case 'Planning':
        return context.l10n.t('profile.pregnancyPlanning');
      case 'Prefer not to say':
        return context.l10n.t('profile.preferNotToSay');
      case 'Not applicable':
      default:
        return context.l10n.t('profile.pregnancyNotApplicable');
    }
  }

  Widget _buildChoiceGroup({
    required BuildContext context,
    required String title,
    required List<String> options,
    required String selectedValue,
    required String Function(String) labelBuilder,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((String option) {
            return ChoiceChip(
              label: Text(labelBuilder(option)),
              selected: selectedValue == option,
              onSelected: (_) => setState(() => onChanged(option)),
            );
          }).toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return PatientScaffold(
      title: l10n.t('profile.questionnaireTitle'),
      subtitle: l10n.t('profile.questionnaireDedicatedSubtitle'),
      showNavigation: false,
      showBack: true,
      bottomAction: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: FilledButton.icon(
            onPressed: _save,
            icon: const Icon(Icons.check_circle_outline),
            label: Text(l10n.t('profile.questionnaireCompleteAndReturn')),
          ),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: l10n.t('profile.questionnaireBadge'),
            title: l10n.t('profile.questionnaireTitle'),
            subtitle: l10n.t('profile.questionnaireDedicatedSubtitle'),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...<Widget>[
            PatientTintedCard(
              tint: const Color(0xFFFEE2E2),
              child: Text(_error!),
            ),
            const SizedBox(height: 16),
          ],
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('profile.questionnaireVitalsTitle'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(l10n.t('profile.questionnaireVitalsBody')),
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: AppTextField(
                        label: l10n.t('profile.heightCm'),
                        controller: _heightController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppTextField(
                        label: l10n.t('profile.weightKg'),
                        controller: _weightController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AppTextField(label: l10n.t('profile.bloodType'), controller: _bloodTypeController),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('profile.questionnaireHistoryTitle'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(l10n.t('profile.questionnaireHistoryBody')),
                const SizedBox(height: 16),
                AppTextField(label: l10n.t('profile.allergies'), controller: _allergiesController, maxLines: 2),
                const SizedBox(height: 12),
                AppTextField(label: l10n.t('profile.conditions'), controller: _conditionsController, maxLines: 2),
                const SizedBox(height: 12),
                AppTextField(label: l10n.t('profile.currentMedications'), controller: _medicationsController, maxLines: 2),
                const SizedBox(height: 12),
                AppTextField(label: l10n.t('profile.pastSurgeries'), controller: _surgeriesController, maxLines: 2),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.t('profile.questionnaireSafetyTitle'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(l10n.t('profile.questionnaireSafetyBody')),
                const SizedBox(height: 16),
                _buildChoiceGroup(
                  context: context,
                  title: l10n.t('profile.smokingStatus'),
                  options: _smokingOptions,
                  selectedValue: _smokingStatus,
                  labelBuilder: (String option) => _smokingLabel(context, option),
                  onChanged: (String option) => _smokingStatus = option,
                ),
                const SizedBox(height: 16),
                _buildChoiceGroup(
                  context: context,
                  title: l10n.t('profile.pregnancyStatus'),
                  options: _pregnancyOptions,
                  selectedValue: _pregnancyStatus,
                  labelBuilder: (String option) => _pregnancyLabel(context, option),
                  onChanged: (String option) => _pregnancyStatus = option,
                ),
                const SizedBox(height: 16),
                AppTextField(label: l10n.t('profile.emergencyNotes'), controller: _emergencyNotesController, maxLines: 3),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
