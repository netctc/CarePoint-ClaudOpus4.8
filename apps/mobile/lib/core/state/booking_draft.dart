class BookingDraft {
  BookingDraft._();

  static final BookingDraft instance = BookingDraft._();

  String? providerId;
  String? providerName;
  String? specialty;
  String service = 'Consultation';
  String location = 'Virtual Care';
  String appointmentType = 'ONLINE_MEETING';
  String serviceMode = 'Both';
  DateTime? startsAt;
  DateTime? endsAt;
  String? slotHoldId;
  DateTime? slotHoldExpiresAt;
  String? appointmentId;
  String? paymentId;
  String? paymentStatus;
  String? paymentNextActionTitle;
  String? paymentNextActionMessage;
  List<String> paymentNextSteps = <String>[];
  List<String> paymentReviewReasons = <String>[];
  String paymentMethod = 'CARD';
  String? walletMethodId;
  bool policyAccepted = false;
  bool intakeCompleted = false;
  bool authorizationConfirmed = false;
  List<String> urgentSymptoms = <String>[];
  Map<String, dynamic>? bookingPolicy;
  int amountMinor = 32000;
  String currency = 'SAR';
  Map<String, dynamic>? providerSnapshot;
  String visitReason = '';
  String symptoms = '';
  String notes = '';
  String insuranceNotes = '';
  bool insuranceUploaded = false;
  bool idUploaded = false;
  String? insuranceDocumentId;
  String? identityDocumentId;
  String? authorizationDocumentId;
  String? insuranceOcrPreview;
  String? identityOcrPreview;
  String? authorizationOcrPreview;
  List<String> insuranceRedactedFields = <String>[];
  List<String> identityRedactedFields = <String>[];

  void hydrateFromProvider(Map<String, dynamic> provider) {
    providerSnapshot = Map<String, dynamic>.from(provider);
    providerId = provider['id']?.toString();
    providerName = provider['name']?.toString();
    specialty = provider['specialty']?.toString() ?? 'General Practice';
    serviceMode = provider['serviceMode']?.toString() ?? 'Both';

    final List<String> services = serviceOptions;
    final List<String> locations = locationOptions;
    if (services.isNotEmpty) {
      service = services.first;
    }
    if (locations.isNotEmpty) {
      location = locations.first;
      appointmentType = location.toLowerCase().contains('virtual') || location.toLowerCase().contains('online') ? 'ONLINE_MEETING' : 'IN_PERSON_VISIT';
    }
  }

  List<String> get serviceOptions {
    final dynamic raw = providerSnapshot?['services'];
    if (raw is List) {
      final List<String> values = raw.map((dynamic item) => item.toString()).where((String item) => item.isNotEmpty).toList();
      if (values.isNotEmpty) {
        return values;
      }
    }
    return <String>['Consultation', 'Follow-up Visit'];
  }

  List<String> get locationOptions {
    final dynamic raw = providerSnapshot?['locations'];
    if (raw is List) {
      final List<String> values = raw.map((dynamic item) => item.toString()).where((String item) => item.isNotEmpty).toList();
      if (values.isNotEmpty) {
        return values;
      }
    }
    if (serviceMode == 'Online') {
      return <String>['Virtual Care'];
    }
    return <String>['Virtual Care', 'Main Clinic'];
  }

  String get priceLabel => '$currency ${(amountMinor / 100).toStringAsFixed(2)}';

  void reset() {
    providerId = null;
    providerName = null;
    specialty = null;
    service = 'Consultation';
    location = 'Virtual Care';
    appointmentType = 'ONLINE_MEETING';
    serviceMode = 'Both';
    startsAt = null;
    endsAt = null;
    slotHoldId = null;
    slotHoldExpiresAt = null;
    appointmentId = null;
    paymentId = null;
    paymentStatus = null;
    paymentNextActionTitle = null;
    paymentNextActionMessage = null;
    paymentNextSteps = <String>[];
    paymentReviewReasons = <String>[];
    amountMinor = 32000;
    currency = 'SAR';
    paymentMethod = 'CARD';
    walletMethodId = null;
    policyAccepted = false;
    intakeCompleted = false;
    authorizationConfirmed = false;
    urgentSymptoms = <String>[];
    bookingPolicy = null;
    providerSnapshot = null;
    visitReason = '';
    symptoms = '';
    notes = '';
    insuranceNotes = '';
    insuranceUploaded = false;
    idUploaded = false;
    insuranceDocumentId = null;
    identityDocumentId = null;
    authorizationDocumentId = null;
    insuranceOcrPreview = null;
    identityOcrPreview = null;
    authorizationOcrPreview = null;
    insuranceRedactedFields = <String>[];
    identityRedactedFields = <String>[];
  }
}
