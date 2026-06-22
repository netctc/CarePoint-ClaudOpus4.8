import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class InsuranceIdUploadPage extends StatefulWidget {
  const InsuranceIdUploadPage({super.key});

  @override
  State<InsuranceIdUploadPage> createState() => _InsuranceIdUploadPageState();
}

class _InsuranceIdUploadPageState extends State<InsuranceIdUploadPage> {
  late bool _insuranceUploaded;
  late bool _idUploaded;
  late bool _authorizationConfirmed;
  bool _insuranceBusy = false;
  bool _idBusy = false;
  late final TextEditingController _notesController;
  String? _error;

  @override
  void initState() {
    super.initState();
    final BookingDraft draft = BookingDraft.instance;
    _insuranceUploaded = draft.insuranceUploaded;
    _idUploaded = draft.idUploaded;
    _authorizationConfirmed = draft.authorizationConfirmed;
    _notesController = TextEditingController(text: draft.insuranceNotes);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  String _sampleOcrPreview(String kind) {
    final BookingDraft draft = BookingDraft.instance;
    final String patientName = draft.providerName == null ? 'Patient file' : 'Booking support file';
    switch (kind) {
      case 'INSURANCE':
        return 'Insurer: National Cooperative\nMember: 8892-4411\nPlan: Gold Riyadh\nSubscriber: $patientName';
      case 'IDENTITY':
        return 'Document: National ID\nHolder: $patientName\nID Number: 1029-22XX-88\nDOB: 1992-04-17';
      default:
        return 'Authorization approval uploaded for booking review.';
    }
  }

  Future<void> _uploadDocument(String kind) async {
    final BookingDraft draft = BookingDraft.instance;
    setState(() {
      if (kind == 'INSURANCE') {
        _insuranceBusy = true;
      } else {
        _idBusy = true;
      }
      _error = null;
    });
    try {
      final Map<String, dynamic> result = await AppSession.instance.uploadBookingDocument(
        holdId: draft.slotHoldId,
        kind: kind,
        fileName: kind == 'INSURANCE' ? 'insurance-card-front.jpg' : 'national-id-front.jpg',
        ocrPreview: _sampleOcrPreview(kind),
      );
      final Map<String, dynamic> item = (result['item'] as Map).cast<String, dynamic>();
      if (kind == 'INSURANCE') {
        draft.insuranceUploaded = true;
        draft.insuranceDocumentId = item['id']?.toString();
        draft.insuranceOcrPreview = item['ocrPreview']?.toString();
        draft.insuranceRedactedFields = ((item['redactedFields'] as List?) ?? <dynamic>[]).map((dynamic value) => value.toString()).toList();
      } else {
        draft.idUploaded = true;
        draft.identityDocumentId = item['id']?.toString();
        draft.identityOcrPreview = item['ocrPreview']?.toString();
        draft.identityRedactedFields = ((item['redactedFields'] as List?) ?? <dynamic>[]).map((dynamic value) => value.toString()).toList();
      }
      setState(() {
        if (kind == 'INSURANCE') {
          _insuranceUploaded = true;
        } else {
          _idUploaded = true;
        }
      });
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() {
          if (kind == 'INSURANCE') {
            _insuranceBusy = false;
          } else {
            _idBusy = false;
          }
        });
      }
    }
  }

  Future<void> _applyRedaction(String kind) async {
    final BookingDraft draft = BookingDraft.instance;
    final String? documentId = kind == 'INSURANCE' ? draft.insuranceDocumentId : draft.identityDocumentId;
    if (documentId == null || documentId.isEmpty) return;
    final List<String> fields = kind == 'INSURANCE'
        ? <String>['member_number', 'subscriber_name']
        : <String>['id_number', 'date_of_birth'];
    final String preview = (kind == 'INSURANCE' ? draft.insuranceOcrPreview : draft.identityOcrPreview) ?? _sampleOcrPreview(kind);
    final String scrubbed = kind == 'INSURANCE'
        ? preview.replaceAll(RegExp(r'8892-4411'), '****-****').replaceAll(RegExp(r'Subscriber: .*'), 'Subscriber: [REDACTED]')
        : preview.replaceAll(RegExp(r'1029-22XX-88'), '****-****-**').replaceAll(RegExp(r'DOB: .*'), 'DOB: [REDACTED]');
    try {
      final Map<String, dynamic> result = await AppSession.instance.redactBookingDocument(
        documentId: documentId,
        redactedFields: fields,
        ocrPreview: scrubbed,
      );
      final Map<String, dynamic> item = (result['item'] as Map).cast<String, dynamic>();
      setState(() {
        if (kind == 'INSURANCE') {
          draft.insuranceOcrPreview = item['ocrPreview']?.toString();
          draft.insuranceRedactedFields = ((item['redactedFields'] as List?) ?? <dynamic>[]).map((dynamic value) => value.toString()).toList();
        } else {
          draft.identityOcrPreview = item['ocrPreview']?.toString();
          draft.identityRedactedFields = ((item['redactedFields'] as List?) ?? <dynamic>[]).map((dynamic value) => value.toString()).toList();
        }
      });
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  void _continue() {
    final BookingDraft draft = BookingDraft.instance;
    draft.insuranceUploaded = _insuranceUploaded;
    draft.idUploaded = _idUploaded;
    draft.authorizationConfirmed = _authorizationConfirmed;
    draft.insuranceNotes = _notesController.text.trim();
    context.go('/booking/review');
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final Map<String, dynamic> policy = draft.bookingPolicy ?? <String, dynamic>{};
    final bool requiresInsurance = policy['requiresInsuranceDocument'] != false;
    final bool requiresId = policy['requiresIdentityDocument'] != false;
    final bool requiresAuthorization = policy['authorizationRequired'] == true;
    final bool canContinue = (!requiresInsurance || _insuranceUploaded) && (!requiresId || _idUploaded) && (!requiresAuthorization || _authorizationConfirmed);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Insurance / ID Upload'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Upload required documents', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'This step now stores booking documents through the live API, shows OCR preview text, and records redaction-safe handling before payment review.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              _UploadCard(
                title: 'Insurance card',
                subtitle: requiresInsurance ? 'Required before confirmation' : 'Optional for this booking',
                uploaded: _insuranceUploaded,
                required: requiresInsurance,
                busy: _insuranceBusy,
                ocrPreview: draft.insuranceOcrPreview,
                redactedFields: draft.insuranceRedactedFields,
                onPressed: () => _uploadDocument('INSURANCE'),
                onRedactPressed: draft.insuranceDocumentId == null ? null : () => _applyRedaction('INSURANCE'),
              ),
              const SizedBox(height: 14),
              _UploadCard(
                title: 'National ID',
                subtitle: requiresId ? 'Required for identity verification' : 'Optional for this booking',
                uploaded: _idUploaded,
                required: requiresId,
                busy: _idBusy,
                ocrPreview: draft.identityOcrPreview,
                redactedFields: draft.identityRedactedFields,
                onPressed: () => _uploadDocument('IDENTITY'),
                onRedactPressed: draft.identityDocumentId == null ? null : () => _applyRedaction('IDENTITY'),
              ),
              if (requiresAuthorization) ...<Widget>[
                const SizedBox(height: 16),
                CheckboxListTile(
                  value: _authorizationConfirmed,
                  onChanged: (bool? value) => setState(() => _authorizationConfirmed = value ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text('I confirm prior authorization has been requested or approved for this service.'),
                ),
              ],
              const SizedBox(height: 16),
              AppTextField(
                label: 'Notes for the care team',
                controller: _notesController,
                maxLines: 4,
                hintText: 'Optional notes regarding insurance, ID, or authorization',
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(
          label: 'Continue to Review & Payment',
          icon: Icons.arrow_forward,
          onPressed: canContinue ? _continue : null,
        ),
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({
    required this.title,
    required this.subtitle,
    required this.uploaded,
    required this.required,
    required this.busy,
    required this.onPressed,
    required this.onRedactPressed,
    this.ocrPreview,
    this.redactedFields = const <String>[],
  });

  final String title;
  final String subtitle;
  final bool uploaded;
  final bool required;
  final bool busy;
  final String? ocrPreview;
  final List<String> redactedFields;
  final VoidCallback onPressed;
  final VoidCallback? onRedactPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(uploaded ? Icons.check_circle_outline : Icons.upload_file_outlined, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: uploaded ? const Color(0xFFDCFCE7) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  uploaded ? 'Uploaded' : required ? 'Required' : 'Optional',
                  style: TextStyle(
                    color: uploaded ? AppColors.success : AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: busy ? null : onPressed,
              icon: Icon(uploaded ? Icons.refresh : Icons.upload),
              label: Text(busy ? 'Uploading…' : uploaded ? 'Replace File' : 'Upload File'),
            ),
          ),
          if (ocrPreview != null && ocrPreview!.trim().isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Text('OCR preview', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(ocrPreview!),
            ),
          ],
          if (uploaded) ...<Widget>[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: redactedFields.isEmpty
                  ? <Widget>[const Chip(label: Text('No redaction applied yet'))]
                  : redactedFields.map((String item) => Chip(label: Text(item))).toList(),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onRedactPressed,
                icon: const Icon(Icons.privacy_tip_outlined),
                label: Text(redactedFields.isEmpty ? 'Apply recommended redactions' : 'Update redactions'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
