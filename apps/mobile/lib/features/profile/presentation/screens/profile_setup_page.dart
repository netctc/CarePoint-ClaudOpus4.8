import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';


class _CountryOption {
  const _CountryOption(this.continent, this.name);

  final String continent;
  final String name;
}

const List<_CountryOption> _countryOptions = <_CountryOption>[
  _CountryOption('Africa', 'Algeria'),
  _CountryOption('Africa', 'Angola'),
  _CountryOption('Africa', 'Benin'),
  _CountryOption('Africa', 'Botswana'),
  _CountryOption('Africa', 'Burkina Faso'),
  _CountryOption('Africa', 'Burundi'),
  _CountryOption('Africa', 'Cabo Verde'),
  _CountryOption('Africa', 'Cameroon'),
  _CountryOption('Africa', 'Central African Republic'),
  _CountryOption('Africa', 'Chad'),
  _CountryOption('Africa', 'Comoros'),
  _CountryOption('Africa', 'Congo'),
  _CountryOption('Africa', 'Cote d Ivoire'),
  _CountryOption('Africa', 'Democratic Republic of the Congo'),
  _CountryOption('Africa', 'Djibouti'),
  _CountryOption('Africa', 'Egypt'),
  _CountryOption('Africa', 'Equatorial Guinea'),
  _CountryOption('Africa', 'Eritrea'),
  _CountryOption('Africa', 'Eswatini'),
  _CountryOption('Africa', 'Ethiopia'),
  _CountryOption('Africa', 'Gabon'),
  _CountryOption('Africa', 'Gambia'),
  _CountryOption('Africa', 'Ghana'),
  _CountryOption('Africa', 'Guinea'),
  _CountryOption('Africa', 'Guinea-Bissau'),
  _CountryOption('Africa', 'Kenya'),
  _CountryOption('Africa', 'Lesotho'),
  _CountryOption('Africa', 'Liberia'),
  _CountryOption('Africa', 'Libya'),
  _CountryOption('Africa', 'Madagascar'),
  _CountryOption('Africa', 'Malawi'),
  _CountryOption('Africa', 'Mali'),
  _CountryOption('Africa', 'Mauritania'),
  _CountryOption('Africa', 'Mauritius'),
  _CountryOption('Africa', 'Morocco'),
  _CountryOption('Africa', 'Mozambique'),
  _CountryOption('Africa', 'Namibia'),
  _CountryOption('Africa', 'Niger'),
  _CountryOption('Africa', 'Nigeria'),
  _CountryOption('Africa', 'Rwanda'),
  _CountryOption('Africa', 'Sao Tome and Principe'),
  _CountryOption('Africa', 'Senegal'),
  _CountryOption('Africa', 'Seychelles'),
  _CountryOption('Africa', 'Sierra Leone'),
  _CountryOption('Africa', 'Somalia'),
  _CountryOption('Africa', 'South Africa'),
  _CountryOption('Africa', 'South Sudan'),
  _CountryOption('Africa', 'Sudan'),
  _CountryOption('Africa', 'Tanzania'),
  _CountryOption('Africa', 'Togo'),
  _CountryOption('Africa', 'Tunisia'),
  _CountryOption('Africa', 'Uganda'),
  _CountryOption('Africa', 'Zambia'),
  _CountryOption('Africa', 'Zimbabwe'),
  _CountryOption('Asia', 'Afghanistan'),
  _CountryOption('Asia', 'Armenia'),
  _CountryOption('Asia', 'Azerbaijan'),
  _CountryOption('Asia', 'Bahrain'),
  _CountryOption('Asia', 'Bangladesh'),
  _CountryOption('Asia', 'Bhutan'),
  _CountryOption('Asia', 'Brunei'),
  _CountryOption('Asia', 'Cambodia'),
  _CountryOption('Asia', 'China'),
  _CountryOption('Asia', 'Cyprus'),
  _CountryOption('Asia', 'Georgia'),
  _CountryOption('Asia', 'India'),
  _CountryOption('Asia', 'Indonesia'),
  _CountryOption('Asia', 'Iran'),
  _CountryOption('Asia', 'Iraq'),
  _CountryOption('Asia', 'Israel'),
  _CountryOption('Asia', 'Japan'),
  _CountryOption('Asia', 'Jordan'),
  _CountryOption('Asia', 'Kazakhstan'),
  _CountryOption('Asia', 'Kuwait'),
  _CountryOption('Asia', 'Kyrgyzstan'),
  _CountryOption('Asia', 'Laos'),
  _CountryOption('Asia', 'Lebanon'),
  _CountryOption('Asia', 'Malaysia'),
  _CountryOption('Asia', 'Maldives'),
  _CountryOption('Asia', 'Mongolia'),
  _CountryOption('Asia', 'Myanmar'),
  _CountryOption('Asia', 'Nepal'),
  _CountryOption('Asia', 'North Korea'),
  _CountryOption('Asia', 'Oman'),
  _CountryOption('Asia', 'Pakistan'),
  _CountryOption('Asia', 'Palestine'),
  _CountryOption('Asia', 'Philippines'),
  _CountryOption('Asia', 'Qatar'),
  _CountryOption('Asia', 'Saudi Arabia'),
  _CountryOption('Asia', 'Singapore'),
  _CountryOption('Asia', 'South Korea'),
  _CountryOption('Asia', 'Sri Lanka'),
  _CountryOption('Asia', 'Syria'),
  _CountryOption('Asia', 'Taiwan'),
  _CountryOption('Asia', 'Tajikistan'),
  _CountryOption('Asia', 'Thailand'),
  _CountryOption('Asia', 'Timor-Leste'),
  _CountryOption('Asia', 'Turkiye'),
  _CountryOption('Asia', 'Turkmenistan'),
  _CountryOption('Asia', 'United Arab Emirates'),
  _CountryOption('Asia', 'Uzbekistan'),
  _CountryOption('Asia', 'Vietnam'),
  _CountryOption('Asia', 'Yemen'),
  _CountryOption('Europe', 'Albania'),
  _CountryOption('Europe', 'Andorra'),
  _CountryOption('Europe', 'Austria'),
  _CountryOption('Europe', 'Belarus'),
  _CountryOption('Europe', 'Belgium'),
  _CountryOption('Europe', 'Bosnia and Herzegovina'),
  _CountryOption('Europe', 'Bulgaria'),
  _CountryOption('Europe', 'Croatia'),
  _CountryOption('Europe', 'Czechia'),
  _CountryOption('Europe', 'Denmark'),
  _CountryOption('Europe', 'Estonia'),
  _CountryOption('Europe', 'Finland'),
  _CountryOption('Europe', 'France'),
  _CountryOption('Europe', 'Germany'),
  _CountryOption('Europe', 'Greece'),
  _CountryOption('Europe', 'Hungary'),
  _CountryOption('Europe', 'Iceland'),
  _CountryOption('Europe', 'Ireland'),
  _CountryOption('Europe', 'Italy'),
  _CountryOption('Europe', 'Kosovo'),
  _CountryOption('Europe', 'Latvia'),
  _CountryOption('Europe', 'Liechtenstein'),
  _CountryOption('Europe', 'Lithuania'),
  _CountryOption('Europe', 'Luxembourg'),
  _CountryOption('Europe', 'Malta'),
  _CountryOption('Europe', 'Moldova'),
  _CountryOption('Europe', 'Monaco'),
  _CountryOption('Europe', 'Montenegro'),
  _CountryOption('Europe', 'Netherlands'),
  _CountryOption('Europe', 'North Macedonia'),
  _CountryOption('Europe', 'Norway'),
  _CountryOption('Europe', 'Poland'),
  _CountryOption('Europe', 'Portugal'),
  _CountryOption('Europe', 'Romania'),
  _CountryOption('Europe', 'Russia'),
  _CountryOption('Europe', 'San Marino'),
  _CountryOption('Europe', 'Serbia'),
  _CountryOption('Europe', 'Slovakia'),
  _CountryOption('Europe', 'Slovenia'),
  _CountryOption('Europe', 'Spain'),
  _CountryOption('Europe', 'Sweden'),
  _CountryOption('Europe', 'Switzerland'),
  _CountryOption('Europe', 'Ukraine'),
  _CountryOption('Europe', 'United Kingdom'),
  _CountryOption('Europe', 'Vatican City'),
  _CountryOption('North America', 'Antigua and Barbuda'),
  _CountryOption('North America', 'Bahamas'),
  _CountryOption('North America', 'Barbados'),
  _CountryOption('North America', 'Belize'),
  _CountryOption('North America', 'Canada'),
  _CountryOption('North America', 'Costa Rica'),
  _CountryOption('North America', 'Cuba'),
  _CountryOption('North America', 'Dominica'),
  _CountryOption('North America', 'Dominican Republic'),
  _CountryOption('North America', 'El Salvador'),
  _CountryOption('North America', 'Grenada'),
  _CountryOption('North America', 'Guatemala'),
  _CountryOption('North America', 'Haiti'),
  _CountryOption('North America', 'Honduras'),
  _CountryOption('North America', 'Jamaica'),
  _CountryOption('North America', 'Mexico'),
  _CountryOption('North America', 'Nicaragua'),
  _CountryOption('North America', 'Panama'),
  _CountryOption('North America', 'Saint Kitts and Nevis'),
  _CountryOption('North America', 'Saint Lucia'),
  _CountryOption('North America', 'Saint Vincent and the Grenadines'),
  _CountryOption('North America', 'Trinidad and Tobago'),
  _CountryOption('North America', 'United States'),
  _CountryOption('South America', 'Argentina'),
  _CountryOption('South America', 'Bolivia'),
  _CountryOption('South America', 'Brazil'),
  _CountryOption('South America', 'Chile'),
  _CountryOption('South America', 'Colombia'),
  _CountryOption('South America', 'Ecuador'),
  _CountryOption('South America', 'Guyana'),
  _CountryOption('South America', 'Paraguay'),
  _CountryOption('South America', 'Peru'),
  _CountryOption('South America', 'Suriname'),
  _CountryOption('South America', 'Uruguay'),
  _CountryOption('South America', 'Venezuela'),
  _CountryOption('Oceania', 'Australia'),
  _CountryOption('Oceania', 'Fiji'),
  _CountryOption('Oceania', 'Kiribati'),
  _CountryOption('Oceania', 'Marshall Islands'),
  _CountryOption('Oceania', 'Micronesia'),
  _CountryOption('Oceania', 'Nauru'),
  _CountryOption('Oceania', 'New Zealand'),
  _CountryOption('Oceania', 'Palau'),
  _CountryOption('Oceania', 'Papua New Guinea'),
  _CountryOption('Oceania', 'Samoa'),
  _CountryOption('Oceania', 'Solomon Islands'),
  _CountryOption('Oceania', 'Tonga'),
  _CountryOption('Oceania', 'Tuvalu'),
  _CountryOption('Oceania', 'Vanuatu'),
];

const List<String> _nationalityOptions = <String>[
  'Lebanese',
  'Saudi',
  'Emirati',
  'Jordanian',
  'Egyptian',
  'Moroccan',
  'Indian',
  'Filipino',
  'French',
  'German',
  'British',
  'Canadian',
  'American',
  'Other',
];

String _safeCountry(String? value) {
  final String trimmed = value?.trim() ?? '';
  if (_countryOptions.any((_CountryOption option) => option.name == trimmed)) return trimmed;
  return 'Lebanon';
}

String _safeNationality(String? value) {
  final String trimmed = value?.trim() ?? '';
  if (_nationalityOptions.contains(trimmed)) return trimmed;
  return 'Lebanese';
}


class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({super.key});

  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _nationalIdController = TextEditingController();
  final TextEditingController _emergencyContactController = TextEditingController();
  final TextEditingController _nationalityController = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _info;

  String? _selectedGender;
  String _selectedRegion = 'Lebanon';
  String _selectedNationality = 'Lebanese';
  bool _shareMedicalDataWithAssignedDoctors = true;

  List<Map<String, dynamic>> _reports = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _scheduledProviders = <Map<String, dynamic>>[];
  Future<Map<String, dynamic>>? _questionnaireOverviewFuture;

  @override
  void initState() {
    super.initState();
    _questionnaireOverviewFuture = Future<Map<String, dynamic>>.value(<String, dynamic>{});
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    final AppSession session = AppSession.instance;
    final bool forcedSelfSubject = !session.profileSetupComplete && !session.isSelfSubject;
    if (forcedSelfSubject) {
      await session.selectSelfSubject();
    }
    _seedIdentityFromSession();
    _questionnaireOverviewFuture = _loadQuestionnaireOverview();
    await _loadPage();
    if (!mounted || !forcedSelfSubject) {
      return;
    }
    setState(() {
      _info = 'Setup must be completed on your own profile first, so the app switched back to My profile.';
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _dobController.dispose();
    _nationalIdController.dispose();
    _emergencyContactController.dispose();
    _nationalityController.dispose();
    super.dispose();
  }

  bool get _isSelfSubject => AppSession.instance.isSelfSubject;

  void _seedIdentityFromSession() {
    final AppSession session = AppSession.instance;
    final Map<String, dynamic>? draft = session.profileDraft;
    final Map<String, dynamic>? me = session.me;
    _nameController.text = draft?['fullName']?.toString() ?? me?['name']?.toString() ?? '';
    _dobController.text = draft?['dateOfBirth']?.toString() ?? '';
    _nationalIdController.text = draft?['nationalId']?.toString() ?? '';
    _emergencyContactController.text = draft?['emergencyContact']?.toString() ?? '';
    _selectedNationality = _safeNationality(draft?['nationality']?.toString());
    _nationalityController.text = _selectedNationality;
    _selectedGender = draft?['gender']?.toString().trim().isEmpty == true ? null : draft?['gender']?.toString();
    _selectedRegion = _safeCountry(draft?['countryRegion']?.toString());
  }

  Future<Map<String, dynamic>> _loadQuestionnaireOverview() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.questionnaireLatest(),
      AppSession.instance.questionnaireHistory(),
    ]);
    return <String, dynamic>{
      'latest': responses[0],
      'history': responses[1],
    };
  }

  Future<void> _loadPage() async {
    setState(() {
      _loading = true;
      _error = null;
      _questionnaireOverviewFuture = _loadQuestionnaireOverview();
    });
    try {
      final Map<String, dynamic> result = await AppSession.instance.loadMedicalProfile();
      final Map<String, dynamic> medical = (result['medical'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final List<Map<String, dynamic>> reports = (((medical['reports'] as List?) ?? <dynamic>[])
          .whereType<Map>()
          .map((Map item) => item.cast<String, dynamic>())
          .toList());
      final List<Map<String, dynamic>> scheduledProviders = (((result['scheduledProviders'] as List?) ?? <dynamic>[])
          .whereType<Map>()
          .map((Map item) => item.cast<String, dynamic>())
          .toList());
      if (!mounted) {
        return;
      }
      setState(() {
        _reports = reports;
        _scheduledProviders = scheduledProviders;
        _shareMedicalDataWithAssignedDoctors = medical['shareMedicalDataWithAssignedDoctors'] == false ? false : true;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = AppSession.instance.lastError ?? error.toString();
      });
    }
  }

  Future<void> _addReport() async {
    final AppLocalizations l10n = context.l10n;
    final TextEditingController nameController = TextEditingController();
    final TextEditingController categoryController = TextEditingController();
    final TextEditingController reportDateController = TextEditingController();
    final TextEditingController providerController = TextEditingController();
    final TextEditingController facilityController = TextEditingController();
    final TextEditingController notesController = TextEditingController();
    bool shareWithDoctors = _shareMedicalDataWithAssignedDoctors;
    final List<String> selectedFileNames = <String>[];

    final bool? saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, void Function(void Function()) setModalState) {
              Future<void> pickMultipleFiles() async {
                final FilePickerResult? result = await FilePicker.platform.pickFiles(
                  allowMultiple: true,
                  withData: false,
                );
                if (result == null) return;
                final List<String> names = result.files
                    .map((PlatformFile file) => file.name)
                    .where((String name) => name.trim().isNotEmpty)
                    .toList();
                setModalState(() {
                  selectedFileNames
                    ..clear()
                    ..addAll(names);
                });
              }

              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(l10n.t('profile.addReport'), style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    AppTextField(label: l10n.t('profile.reportFileName'), controller: nameController),
                    const SizedBox(height: 6),
                    Text(
                      'Optional when you select files below. If multiple files are selected, each file will be added as its own report entry.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('profile.reportCategory'), controller: categoryController),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('profile.reportDate'), controller: reportDateController),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('profile.providerName'), controller: providerController),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('profile.facilityName'), controller: facilityController),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('profile.notes'), controller: notesController, maxLines: 3),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: pickMultipleFiles,
                            icon: const Icon(Icons.attach_file),
                            label: Text(selectedFileNames.isEmpty ? 'Upload files' : 'Replace selected files'),
                          ),
                        ),
                      ],
                    ),
                    if (selectedFileNames.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 12),
                      Text(
                        'Selected files (${selectedFileNames.length})',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: selectedFileNames
                            .map((String name) => Chip(
                                  label: Text(name, overflow: TextOverflow.ellipsis),
                                  onDeleted: () {
                                    setModalState(() => selectedFileNames.remove(name));
                                  },
                                ))
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      value: shareWithDoctors,
                      title: Text(l10n.t('profile.shareWithDoctors')),
                      subtitle: Text(l10n.t('profile.shareWithDoctorsBody')),
                      onChanged: (bool value) => setModalState(() => shareWithDoctors = value),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(context).pop(false),
                            child: Text(l10n.t('common.cancel')),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () {
                              if (categoryController.text.trim().isEmpty ||
                                  (nameController.text.trim().isEmpty && selectedFileNames.isEmpty)) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(l10n.t('common.requiredField'))),
                                );
                                return;
                              }
                              Navigator.of(context).pop(true);
                            },
                            child: Text(l10n.t('common.done')),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );

    if (saved == true) {
      final List<String> fileNames = selectedFileNames.isNotEmpty
          ? selectedFileNames
          : <String>[nameController.text.trim()];
      final List<Map<String, dynamic>> newReports = fileNames
          .where((String item) => item.trim().isNotEmpty)
          .map(
            (String fileName) => <String, dynamic>{
              'id': '${DateTime.now().microsecondsSinceEpoch}-${fileName.hashCode}',
              'fileName': fileName,
              'category': categoryController.text.trim(),
              'reportDate': reportDateController.text.trim(),
              'providerName': providerController.text.trim(),
              'facilityName': facilityController.text.trim(),
              'notes': notesController.text.trim(),
              'grantedToScheduledDoctors': shareWithDoctors,
              'accessScope': shareWithDoctors ? 'SCHEDULED_DOCTORS_ONLY' : 'PRIVATE',
              'uploadedAt': DateTime.now().toIso8601String(),
            },
          )
          .toList();
      setState(() {
        _reports = <Map<String, dynamic>>[
          ..._reports,
          ...newReports,
        ];
        _info = '${newReports.length} report${newReports.length == 1 ? '' : 's'} added successfully.';
      });
    }

    nameController.dispose();
    categoryController.dispose();
    reportDateController.dispose();
    providerController.dispose();
    facilityController.dispose();
    notesController.dispose();
  }

  Future<void> _save() async {
    final AppLocalizations l10n = context.l10n;
    if (_isSelfSubject &&
        (_nameController.text.trim().isEmpty ||
            _dobController.text.trim().isEmpty ||
            _selectedGender == null ||
            _emergencyContactController.text.trim().isEmpty)) {
      setState(() => _error = l10n.t('profile.requiredError'));
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
      _info = null;
    });

    try {
      if (_isSelfSubject) {
        await AppSession.instance.saveProfileSetup(<String, dynamic>{
          'fullName': _nameController.text.trim(),
          'dateOfBirth': _dobController.text.trim(),
          'nationalId': _nationalIdController.text.trim(),
          'emergencyContact': _emergencyContactController.text.trim(),
          'gender': _selectedGender,
          'nationality': _selectedNationality,
          'countryRegion': _selectedRegion,
        });
      }
      await AppSession.instance.saveMedicalProfile(
        reports: _reports,
        shareMedicalDataWithAssignedDoctors: _shareMedicalDataWithAssignedDoctors,
      );
      await AppSession.instance.loadMeAndOnboarding();
      if (!mounted) {
        return;
      }
      if (!AppSession.instance.profileSetupComplete) {
        setState(() {
          _error = 'Profile setup is still incomplete. Please complete all required personal information fields before continuing.';
        });
        return;
      }
      context.go('/home');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = AppSession.instance.lastError ?? error.toString());
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Widget _buildIdentitySection(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return PatientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Personal information',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          AppTextField(label: l10n.t('profile.fullName'), controller: _nameController),
          const SizedBox(height: 12),
          AppTextField(label: l10n.t('profile.dateOfBirth'), controller: _dobController),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _selectedGender,
            decoration: InputDecoration(labelText: l10n.t('profile.gender')),
            items: <DropdownMenuItem<String>>[
              DropdownMenuItem(value: 'Female', child: Text(l10n.t('profile.genderFemale'))),
              DropdownMenuItem(value: 'Male', child: Text(l10n.t('profile.genderMale'))),
              DropdownMenuItem(value: 'Prefer not to say', child: Text(l10n.t('profile.genderPreferNot'))),
            ],
            onChanged: (String? value) => setState(() => _selectedGender = value),
          ),
          const SizedBox(height: 12),
          AppTextField(label: l10n.t('profile.nationalId'), controller: _nationalIdController),
          const SizedBox(height: 12),
          AppTextField(label: l10n.t('profile.emergencyContact'), controller: _emergencyContactController),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _selectedNationality,
            isExpanded: true,
            decoration: InputDecoration(labelText: l10n.t('profile.nationality')),
            items: _nationalityOptions
                .map((String nationality) => DropdownMenuItem<String>(
                      value: nationality,
                      child: Text(nationality),
                    ))
                .toList(),
            onChanged: (String? value) => setState(() {
              _selectedNationality = _safeNationality(value);
              _nationalityController.text = _selectedNationality;
            }),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _selectedRegion,
            isExpanded: true,
            decoration: InputDecoration(labelText: l10n.t('profile.region')),
            items: _countryOptions
                .map((_CountryOption option) => DropdownMenuItem<String>(
                      value: option.name,
                      child: Text('${option.continent} — ${option.name}'),
                    ))
                .toList(),
            onChanged: (String? value) => setState(() => _selectedRegion = _safeCountry(value)),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionnaireSection(BuildContext context) {
    return PatientCard(
      child: FutureBuilder<Map<String, dynamic>>(
        future: _questionnaireOverviewFuture,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          final Map<String, dynamic>? latestResponse = (snapshot.data?['latest'] as Map?)?.cast<String, dynamic>();
          final Map<String, dynamic>? latest = (latestResponse?['latest'] as Map?)?.cast<String, dynamic>();
          final List<Map<String, dynamic>> history = (((snapshot.data?['history'] as Map?)?['items'] as List?) ?? <dynamic>[])
              .whereType<Map>()
              .map((Map item) => item.cast<String, dynamic>())
              .toList();
          final String latestId = latest?['id']?.toString() ?? 'legacy-current';
          final String summary = latest?['summary']?.toString() ?? '';
          final String versionLabel = latest == null ? 'Not completed yet' : 'Version ${latest['versionNumber'] ?? 1}';
          final String completion = latest?['completionScore'] == null
              ? ''
              : '${latest!['completionScore']}% complete';

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const Icon(Icons.quiz_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Health questionnaire',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Review the latest answers, update the questionnaire, and open previous versions from your Profile page.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              if (snapshot.connectionState == ConnectionState.waiting)
                const LinearProgressIndicator(minHeight: 6)
              else if (snapshot.hasError)
                PatientTintedCard(
                  tint: const Color(0xFFFFF7ED),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Unable to load questionnaire summary', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(snapshot.error.toString(), style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                )
              else
                PatientTintedCard(
                  tint: const Color(0xFFF5F9FF),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              latest == null ? 'No questionnaire submitted yet' : versionLabel,
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          if (completion.isNotEmpty) PatientStatusBadge(label: completion),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        summary.isNotEmpty
                            ? summary
                            : (latest == null
                                ? 'Start the questionnaire here to record allergies, conditions, medications, and other health background details.'
                                : 'Latest questionnaire results are available from this section.'),
                      ),
                      if (history.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 10),
                        Text(
                          '${history.length} saved version${history.length == 1 ? '' : 's'} available in history.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
              const SizedBox(height: 14),
              Row(
                children: <Widget>[
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => context.go('/health-questionnaire'),
                      icon: const Icon(Icons.edit_note_outlined),
                      label: Text(latest == null ? 'Start questionnaire' : 'Open questionnaire'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: latest == null ? null : () => context.go('/health-questionnaire/version?id=${Uri.encodeComponent(latestId)}'),
                      icon: const Icon(Icons.visibility_outlined),
                      label: const Text('Latest result'),
                    ),
                  ),
                ],
              ),
              if (history.isNotEmpty) ...<Widget>[
                const SizedBox(height: 12),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: () => context.go('/health-questionnaire'),
                    icon: const Icon(Icons.history_outlined),
                    label: Text('View questionnaire history (${history.length})'),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildReportsSection(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return PatientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(l10n.t('profile.reportsTitle'), style: Theme.of(context).textTheme.titleLarge)),
              FilledButton.tonalIcon(
                onPressed: _addReport,
                icon: const Icon(Icons.add),
                label: Text(l10n.t('profile.addReport')),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(l10n.t('profile.reportsBody')),
          const SizedBox(height: 8),
          Text(
            'You can upload one or many files in a single submission. Each selected file will be stored as its own report entry.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          SwitchListTile.adaptive(
            value: _shareMedicalDataWithAssignedDoctors,
            contentPadding: EdgeInsets.zero,
            onChanged: (bool value) => setState(() => _shareMedicalDataWithAssignedDoctors = value),
            title: Text(l10n.t('profile.shareWithDoctors')),
            subtitle: Text(l10n.t('profile.shareWithDoctorsBody')),
          ),
          if (_scheduledProviders.isNotEmpty) ...<Widget>[
            const SizedBox(height: 8),
            Text(l10n.t('profile.sharedDoctorList'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            ..._scheduledProviders.take(3).map((Map<String, dynamic> provider) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('• ${provider['providerName'] ?? provider['service'] ?? 'Doctor'}'),
                )),
          ],
          const SizedBox(height: 8),
          if (_reports.isEmpty)
            PatientEmptyState(
              title: l10n.t('profile.noReportsTitle'),
              body: l10n.t('profile.noReportsBody'),
              icon: Icons.description_outlined,
            )
          else
            ..._reports.asMap().entries.map(
                  (MapEntry<int, Map<String, dynamic>> entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          const Icon(Icons.insert_drive_file_outlined),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  entry.value['fileName']?.toString() ?? 'Report',
                                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text(entry.value['category']?.toString() ?? ''),
                                if ((entry.value['notes']?.toString() ?? '').isNotEmpty) ...<Widget>[
                                  const SizedBox(height: 4),
                                  Text(entry.value['notes']?.toString() ?? ''),
                                ],
                                const SizedBox(height: 6),
                                PatientStatusBadge(label: entry.value['accessScope']?.toString() ?? 'PRIVATE'),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () {
                              setState(() {
                                _reports.removeAt(entry.key);
                              });
                            },
                            icon: const Icon(Icons.delete_outline),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildMessageCard(BuildContext context, String message, {required bool error}) {
    return PatientTintedCard(
      tint: error ? const Color(0xFFFEE2E2) : const Color(0xFFECFDF5),
      child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;

    if (_loading) {
      return PatientScaffold(
        title: l10n.t('profile.title'),
        subtitle: l10n.t('profile.subtitle'),
        showNavigation: false,
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    return PatientScaffold(
      title: l10n.t('profile.title'),
      subtitle: l10n.t('profile.subtitle'),
      showNavigation: false,
      bottomAction: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.check_circle_outline),
            label: Text(_saving ? l10n.t('common.saving') : l10n.t('common.finishSetup')),
          ),
        ),
      ),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          return RefreshIndicator(
            onRefresh: _loadPage,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    PatientHeroCard(
                      badge: _isSelfSubject ? l10n.t('profile.heroBadge') : l10n.t('profile.familyBadge'),
                      title: _isSelfSubject ? l10n.t('profile.heroTitle') : l10n.t('profile.familyHeroTitle'),
                      subtitle: _isSelfSubject ? l10n.t('profile.heroBody') : l10n.t('profile.familyHeroBody'),
                    ),
                    if (!_isSelfSubject) ...<Widget>[
                      const SizedBox(height: 16),
                      PatientActiveProfileCard(
                        label: AppSession.instance.activeSubjectLabel,
                        relationship: AppSession.instance.activeSubjectRelationship,
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (_error != null) ...<Widget>[
                      _buildMessageCard(context, _error!, error: true),
                      const SizedBox(height: 16),
                    ],
                    if (_info != null) ...<Widget>[
                      _buildMessageCard(context, _info!, error: false),
                      const SizedBox(height: 16),
                    ],
                    if (_isSelfSubject) ...<Widget>[
                      _buildIdentitySection(context),
                      const SizedBox(height: 16),
                    ],
                    _buildQuestionnaireSection(context),
                    const SizedBox(height: 16),
                    _buildReportsSection(context),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
