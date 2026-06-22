import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class AppointmentIntakeFormPage extends StatefulWidget {
  const AppointmentIntakeFormPage({super.key});

  @override
  State<AppointmentIntakeFormPage> createState() => _AppointmentIntakeFormPageState();
}

class _AppointmentIntakeFormPageState extends State<AppointmentIntakeFormPage> {
  late final TextEditingController _reasonController;
  late final TextEditingController _symptomsController;
  late final TextEditingController _notesController;

  bool _chestPain = false;
  bool _shortnessOfBreath = false;
  bool _dizziness = false;
  bool _palpitations = false;
  bool _accepted = true;
  bool _notEmergency = false;

  @override
  void initState() {
    super.initState();
    final BookingDraft draft = BookingDraft.instance;
    _reasonController = TextEditingController(text: draft.visitReason);
    _symptomsController = TextEditingController(text: draft.symptoms);
    _notesController = TextEditingController(text: draft.notes);
    _chestPain = draft.urgentSymptoms.contains('Chest pain');
    _shortnessOfBreath = draft.urgentSymptoms.contains('Shortness of breath');
    _dizziness = draft.urgentSymptoms.contains('Dizziness');
    _palpitations = draft.urgentSymptoms.contains('Palpitations');
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _symptomsController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  List<String> get _urgentSymptoms => <String>[
        if (_chestPain) 'Chest pain',
        if (_shortnessOfBreath) 'Shortness of breath',
        if (_dizziness) 'Dizziness',
        if (_palpitations) 'Palpitations',
      ];

  void _continue() {
    final BookingDraft draft = BookingDraft.instance;
    draft.visitReason = _reasonController.text.trim();
    draft.symptoms = _symptomsController.text.trim();
    draft.notes = _notesController.text.trim();
    draft.urgentSymptoms = _urgentSymptoms;
    draft.intakeCompleted = true;
    context.go('/booking/docs');
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final Map<String, dynamic> policy = draft.bookingPolicy ?? <String, dynamic>{};
    final bool requiresAuthorization = policy['authorizationRequired'] == true;
    final int leadHours = (policy['bookingLeadHours'] as num?)?.toInt() ?? 2;
    final bool hasUrgentSymptoms = _urgentSymptoms.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointment Intake Form'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Tell us about your visit', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'This intake is now validated with the live booking policy before payment is created.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Booking policy snapshot', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Text('Minimum lead time: $leadHours hours'),
                    Text(requiresAuthorization ? 'Prior authorization will be required before final confirmation.' : 'No prior authorization is required for this booking.'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              AppTextField(
                label: 'Visit reason',
                controller: _reasonController,
                hintText: 'Brief reason for the visit',
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Current symptoms',
                controller: _symptomsController,
                maxLines: 4,
                hintText: 'Describe symptoms and when they started',
              ),
              const SizedBox(height: 20),
              Text(
                'Urgent symptom checklist',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              _SymptomTile(label: 'Chest pain', value: _chestPain, onChanged: (bool value) => setState(() => _chestPain = value)),
              _SymptomTile(label: 'Shortness of breath', value: _shortnessOfBreath, onChanged: (bool value) => setState(() => _shortnessOfBreath = value)),
              _SymptomTile(label: 'Dizziness', value: _dizziness, onChanged: (bool value) => setState(() => _dizziness = value)),
              _SymptomTile(label: 'Palpitations', value: _palpitations, onChanged: (bool value) => setState(() => _palpitations = value)),
              if (hasUrgentSymptoms) ...<Widget>[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF59E0B)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Urgent symptoms selected', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      const Text('If this is an emergency, call your local emergency service immediately instead of waiting for a routine booking.'),
                      CheckboxListTile(
                        value: _notEmergency,
                        onChanged: (bool? value) => setState(() => _notEmergency = value ?? false),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: const Text('I understand this is not an emergency and I still want to continue with booking.'),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              AppTextField(
                label: 'Additional notes',
                controller: _notesController,
                maxLines: 4,
                hintText: 'Medical history, medications, or attachments to mention',
              ),
              const SizedBox(height: 12),
              CheckboxListTile(
                value: _accepted,
                onChanged: (bool? value) => setState(() => _accepted = value ?? false),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text('I confirm the information provided is accurate to the best of my knowledge.'),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(
          label: 'Continue to Insurance / ID Upload',
          icon: Icons.arrow_forward,
          onPressed: _accepted && (!hasUrgentSymptoms || _notEmergency) ? _continue : null,
        ),
      ),
    );
  }
}

class _SymptomTile extends StatelessWidget {
  const _SymptomTile({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: SwitchListTile(
        value: value,
        onChanged: onChanged,
        title: Text(label),
        activeThumbColor: AppColors.primary,
      ),
    );
  }
}
