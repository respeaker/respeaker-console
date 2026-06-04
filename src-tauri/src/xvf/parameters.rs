// Parameter table for ReSpeaker XVF3800.
// Direct port of PARAMETERS in `xvf_host.py`.
//
// Each entry: (name, resid, cmdid, length, access, kind, description)
// - access: "ro" (read-only), "wo" (write-only), "rw" (read-write)
// - kind:   primitive data type name used for encoding / decoding payloads
//
// Keep this list in sync with the reference Python host script. Any command
// added here is automatically exposed to the frontend via the
// `xvf_list_commands` Tauri command.

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Parameter {
    pub name: &'static str,
    pub resid: u8,
    pub cmdid: u8,
    pub length: u16,
    pub access: &'static str,
    pub kind: &'static str,
    pub description: &'static str,
}

impl Parameter {
    pub fn is_readable(&self) -> bool {
        self.access == "ro" || self.access == "rw"
    }

    pub fn is_writable(&self) -> bool {
        self.access == "wo" || self.access == "rw"
    }
}

macro_rules! p {
    ($name:literal, $resid:literal, $cmdid:literal, $length:literal, $access:literal, $kind:literal, $desc:literal) => {
        Parameter {
            name: $name,
            resid: $resid,
            cmdid: $cmdid,
            length: $length,
            access: $access,
            kind: $kind,
            description: $desc,
        }
    };
}

pub static PARAMETERS: &[Parameter] = &[
    // APPLICATION_SERVICER_RESID commands
    p!(
        "VERSION",
        48,
        0,
        3,
        "ro",
        "uint8",
        "Firmware version VERSION_MAJOR VERSION_MINOR VERSION_PATCH"
    ),
    p!("BLD_MSG", 48, 1, 50, "ro", "char", "Firmware build message"),
    p!("BLD_HOST", 48, 2, 30, "ro", "char", "CI build host details"),
    p!(
        "BLD_REPO_HASH",
        48,
        3,
        40,
        "ro",
        "char",
        "GIT hash of the sw_xvf3800 repo used to build the firmware"
    ),
    p!(
        "BLD_MODIFIED",
        48,
        4,
        6,
        "ro",
        "char",
        "Whether the firmware repo has been modified from the official release"
    ),
    p!(
        "BOOT_STATUS",
        48,
        5,
        3,
        "ro",
        "char",
        "Whether the firmware was booted via SPI or JTAG/FLASH"
    ),
    p!(
        "TEST_CORE_BURN",
        48,
        6,
        1,
        "rw",
        "uint8",
        "Enable core burn (internal testing only)"
    ),
    p!(
        "REBOOT",
        48,
        7,
        1,
        "wo",
        "uint8",
        "Set to any value to reboot the chip"
    ),
    p!(
        "USB_BIT_DEPTH",
        48,
        8,
        2,
        "rw",
        "uint8",
        "USB bit depth for UA variants"
    ),
    p!(
        "SAVE_CONFIGURATION",
        48,
        9,
        1,
        "wo",
        "uint8",
        "Save current configuration to flash"
    ),
    p!(
        "CLEAR_CONFIGURATION",
        48,
        10,
        1,
        "wo",
        "uint8",
        "Clear the current configuration and revert to defaults"
    ),
    // AEC_RESID commands
    p!("SHF_BYPASS", 33, 70, 1, "rw", "uint8", "AEC bypass"),
    p!(
        "AEC_NUM_MICS",
        33,
        71,
        1,
        "ro",
        "int32",
        "Number of microphone inputs into the AEC"
    ),
    p!(
        "AEC_NUM_FARENDS",
        33,
        72,
        1,
        "ro",
        "int32",
        "Number of farend inputs into the AEC"
    ),
    p!(
        "AEC_MIC_ARRAY_TYPE",
        33,
        73,
        1,
        "ro",
        "int32",
        "Microphone array type (1 - linear, 2 - squarecular)"
    ),
    p!(
        "AEC_MIC_ARRAY_GEO",
        33,
        74,
        12,
        "ro",
        "float",
        "Microphone array geometry (XYZ per mic, meters)"
    ),
    p!(
        "AEC_AZIMUTH_VALUES",
        33,
        75,
        4,
        "ro",
        "radians",
        "Azimuth values for beams (radians)"
    ),
    p!(
        "AEC_CURRENT_IDLE_TIME",
        33,
        77,
        1,
        "ro",
        "uint32",
        "AEC processing current idle time in 10ns ticks"
    ),
    p!(
        "AEC_MIN_IDLE_TIME",
        33,
        78,
        1,
        "ro",
        "uint32",
        "AEC processing minimum idle time in 10ns ticks"
    ),
    p!(
        "AEC_RESET_MIN_IDLE_TIME",
        33,
        79,
        1,
        "wo",
        "uint32",
        "Reset the AEC minimum idle time"
    ),
    p!(
        "AEC_SPENERGY_VALUES",
        33,
        80,
        4,
        "ro",
        "float",
        "Speech energy level per beam"
    ),
    p!(
        "AEC_FIXEDBEAMSAZIMUTH_VALUES",
        33,
        81,
        2,
        "rw",
        "radians",
        "Azimuth values for fixed-mode beams"
    ),
    p!(
        "AEC_FIXEDBEAMSELEVATION_VALUES",
        33,
        82,
        2,
        "rw",
        "radians",
        "Elevation for fixed-mode beams"
    ),
    p!(
        "AEC_FIXEDBEAMSGATING",
        33,
        83,
        1,
        "rw",
        "uint8",
        "Enable/disable gating for beams in fixed mode"
    ),
    p!(
        "AEC_AECPATHCHANGE",
        33,
        0,
        1,
        "ro",
        "int32",
        "AEC Path Change Detection. 0/1"
    ),
    p!(
        "AEC_HPFONOFF",
        33,
        1,
        1,
        "rw",
        "int32",
        "High-pass Filter on microphone signals. 0..4"
    ),
    p!(
        "AEC_AECSILENCELEVEL",
        33,
        2,
        2,
        "rw",
        "float",
        "Power threshold for signal detection in adaptive filter"
    ),
    p!(
        "AEC_AECCONVERGED",
        33,
        3,
        1,
        "ro",
        "int32",
        "Flag indicating whether AEC is converged. 0/1"
    ),
    p!(
        "AEC_AECEMPHASISONOFF",
        33,
        4,
        1,
        "rw",
        "int32",
        "Pre/de-emphasis filter for AEC. 0/1/2"
    ),
    p!(
        "AEC_FAR_EXTGAIN",
        33,
        5,
        1,
        "rw",
        "float",
        "External gain (dB) applied to far-end reference signals"
    ),
    p!(
        "AEC_PCD_COUPLINGI",
        33,
        6,
        1,
        "rw",
        "float",
        "Sensitivity parameter for PCD [0.0..1.0]"
    ),
    p!(
        "AEC_PCD_MINTHR",
        33,
        7,
        1,
        "rw",
        "float",
        "Minimum threshold value used in PCD"
    ),
    p!(
        "AEC_PCD_MAXTHR",
        33,
        8,
        1,
        "rw",
        "float",
        "Maximum threshold value used in PCD"
    ),
    p!(
        "AEC_RT60",
        33,
        9,
        1,
        "ro",
        "float",
        "Current RT60 estimate (seconds). Negative: invalid"
    ),
    p!(
        "AEC_ASROUTONOFF",
        33,
        35,
        1,
        "rw",
        "int32",
        "Automatic speech recognition output. 0/1"
    ),
    p!(
        "AEC_ASROUTGAIN",
        33,
        36,
        1,
        "rw",
        "float",
        "Fixed gain applied to ASR output"
    ),
    p!(
        "AEC_FIXEDBEAMSONOFF",
        33,
        37,
        1,
        "rw",
        "int32",
        "Enable/disable fixed focused beam mode. 0/1"
    ),
    p!(
        "AEC_FIXEDBEAMNOISETHR",
        33,
        38,
        2,
        "rw",
        "float",
        "Threshold for updating the noise canceller in fixed beam mode"
    ),
    // AUDIO_MGR_RESID commands
    p!(
        "AUDIO_MGR_MIC_GAIN",
        35,
        0,
        1,
        "rw",
        "float",
        "Audio Mgr pre SHF microphone gain"
    ),
    p!(
        "AUDIO_MGR_REF_GAIN",
        35,
        1,
        1,
        "rw",
        "float",
        "Audio Mgr pre SHF reference gain"
    ),
    p!(
        "AUDIO_MGR_CURRENT_IDLE_TIME",
        35,
        2,
        1,
        "ro",
        "int32",
        "Audio manager current idle time (10ns ticks)"
    ),
    p!(
        "AUDIO_MGR_MIN_IDLE_TIME",
        35,
        3,
        1,
        "ro",
        "int32",
        "Audio manager min idle time (10ns ticks)"
    ),
    p!(
        "AUDIO_MGR_RESET_MIN_IDLE_TIME",
        35,
        4,
        1,
        "wo",
        "int32",
        "Reset audio manager min idle time"
    ),
    p!(
        "MAX_CONTROL_TIME",
        35,
        5,
        1,
        "ro",
        "int32",
        "Audio manager max control time"
    ),
    p!(
        "RESET_MAX_CONTROL_TIME",
        35,
        6,
        1,
        "wo",
        "int32",
        "Reset audio manager max control time"
    ),
    p!(
        "I2S_CURRENT_IDLE_TIME",
        35,
        7,
        1,
        "ro",
        "int32",
        "I2S current idle time (10ns ticks)"
    ),
    p!(
        "I2S_MIN_IDLE_TIME",
        35,
        8,
        1,
        "ro",
        "int32",
        "I2S min idle time (10ns ticks)"
    ),
    p!(
        "I2S_RESET_MIN_IDLE_TIME",
        35,
        9,
        1,
        "wo",
        "int32",
        "I2S reset idle time"
    ),
    p!(
        "I2S_INPUT_PACKED",
        35,
        10,
        1,
        "rw",
        "uint8",
        "Expect packed input on I2S or USB channels"
    ),
    p!(
        "AUDIO_MGR_SELECTED_AZIMUTHS",
        35,
        11,
        2,
        "ro",
        "radians",
        "Processed DoA and auto-select beam DoA"
    ),
    p!(
        "AUDIO_MGR_SELECTED_CHANNELS",
        35,
        12,
        2,
        "rw",
        "uint8",
        "Selected channels for MUX_USER_CHOSEN_CHANNELS"
    ),
    p!(
        "AUDIO_MGR_OP_PACKED",
        35,
        13,
        2,
        "rw",
        "uint8",
        "Packing status for L and R output channels"
    ),
    p!(
        "AUDIO_MGR_OP_UPSAMPLE",
        35,
        14,
        2,
        "rw",
        "uint8",
        "Upsample status for L and R output channels"
    ),
    p!(
        "AUDIO_MGR_OP_L",
        35,
        15,
        2,
        "rw",
        "uint8",
        "Category and source for L output channel"
    ),
    p!(
        "AUDIO_MGR_OP_R",
        35,
        19,
        2,
        "rw",
        "uint8",
        "Category and source for R output channel"
    ),
    p!(
        "I2S_INACTIVE",
        35,
        24,
        1,
        "ro",
        "uint8",
        "Whether the main audio loop is exchanging samples with I2S"
    ),
    p!(
        "AUDIO_MGR_FAR_END_DSP_ENABLE",
        35,
        25,
        1,
        "rw",
        "uint8",
        "Enable/disable far-end DSP"
    ),
    p!(
        "AUDIO_MGR_SYS_DELAY",
        35,
        26,
        1,
        "rw",
        "int32",
        "Delay (samples) applied to reference signal before SHF"
    ),
    p!(
        "I2S_DAC_DSP_ENABLE",
        35,
        27,
        1,
        "rw",
        "uint8",
        "Indicates if the DAC performs DSP on far-end reference"
    ),
    // GPO_SERVICER_RESID / LED commands
    p!(
        "GPO_READ_VALUES",
        20,
        0,
        5,
        "ro",
        "uint8",
        "Get current logic level of all GPO pins"
    ),
    p!(
        "GPO_WRITE_VALUE",
        20,
        1,
        2,
        "wo",
        "uint8",
        "Set current logic level of a GPO pin"
    ),
    p!(
        "LED_EFFECT",
        20,
        12,
        1,
        "rw",
        "uint8",
        "LED effect mode: 0=off, 1=breath, 2=rainbow, 3=single, 4=doa, 5=ring"
    ),
    p!(
        "LED_BRIGHTNESS",
        20,
        13,
        1,
        "rw",
        "uint8",
        "LED brightness for breath and rainbow modes"
    ),
    p!(
        "LED_GAMMIFY",
        20,
        14,
        1,
        "rw",
        "uint8",
        "Enable gamma correction: 0=disable, 1=enable"
    ),
    p!(
        "LED_SPEED",
        20,
        15,
        1,
        "rw",
        "uint8",
        "Effect speed for breath and rainbow modes"
    ),
    p!(
        "LED_COLOR",
        20,
        16,
        1,
        "rw",
        "uint32",
        "LED color for breath/single color modes (0xRRGGBB)"
    ),
    p!(
        "LED_DOA_COLOR",
        20,
        17,
        2,
        "rw",
        "uint32",
        "DoA colors: base, highlight"
    ),
    p!(
        "DOA_VALUE",
        20,
        18,
        2,
        "ro",
        "uint16",
        "DoA value [0..359] and VAD flag"
    ),
    p!(
        "LED_RING_COLOR",
        20,
        19,
        12,
        "rw",
        "uint32",
        "LED color per LED for ring mode"
    ),
    // PP_RESID commands
    p!(
        "PP_CURRENT_IDLE_TIME",
        17,
        70,
        1,
        "ro",
        "uint32",
        "PP processing current idle time in 10ns ticks"
    ),
    p!(
        "PP_MIN_IDLE_TIME",
        17,
        71,
        1,
        "ro",
        "uint32",
        "PP processing minimum idle time in 10ns ticks"
    ),
    p!(
        "PP_RESET_MIN_IDLE_TIME",
        17,
        72,
        1,
        "wo",
        "uint32",
        "Reset the PP minimum idle time"
    ),
    p!(
        "PP_AGCONOFF",
        17,
        10,
        1,
        "rw",
        "int32",
        "Automatic Gain Control. 0/1"
    ),
    p!(
        "PP_AGCMAXGAIN",
        17,
        11,
        1,
        "rw",
        "float",
        "Maximum AGC gain factor [1.0..1000.0]"
    ),
    p!(
        "PP_AGCDESIREDLEVEL",
        17,
        12,
        1,
        "rw",
        "float",
        "Target power level of the output signal"
    ),
    p!(
        "PP_AGCGAIN",
        17,
        13,
        1,
        "rw",
        "float",
        "Current AGC gain factor"
    ),
    p!(
        "PP_AGCTIME",
        17,
        14,
        1,
        "rw",
        "float",
        "Ramp-up/down time-constant"
    ),
    p!(
        "PP_AGCFASTTIME",
        17,
        15,
        1,
        "rw",
        "float",
        "Fast ramp-down time-constant"
    ),
    p!(
        "PP_AGCALPHAFASTGAIN",
        17,
        16,
        1,
        "rw",
        "float",
        "Gain threshold enabling fast alpha mode"
    ),
    p!(
        "PP_AGCALPHASLOW",
        17,
        17,
        1,
        "rw",
        "float",
        "Slow memory parameter for speech power"
    ),
    p!(
        "PP_AGCALPHAFAST",
        17,
        18,
        1,
        "rw",
        "float",
        "Fast memory parameter for speech power"
    ),
    p!(
        "PP_LIMITONOFF",
        17,
        19,
        1,
        "rw",
        "int32",
        "Limiter on communication output. 0/1"
    ),
    p!(
        "PP_LIMITPLIMIT",
        17,
        20,
        1,
        "rw",
        "float",
        "Maximum limiter power"
    ),
    p!(
        "PP_MIN_NS",
        17,
        21,
        1,
        "rw",
        "float",
        "Gain-floor for stationary noise suppression"
    ),
    p!(
        "PP_MIN_NN",
        17,
        22,
        1,
        "rw",
        "float",
        "Gain-floor for non-stationary noise suppression"
    ),
    p!(
        "PP_ECHOONOFF",
        17,
        23,
        1,
        "rw",
        "int32",
        "Echo suppression. 0/1"
    ),
    p!(
        "PP_GAMMA_E",
        17,
        24,
        1,
        "rw",
        "float",
        "Over-subtraction factor of echo (direct/early)"
    ),
    p!(
        "PP_GAMMA_ETAIL",
        17,
        25,
        1,
        "rw",
        "float",
        "Over-subtraction factor of echo (tail)"
    ),
    p!(
        "PP_GAMMA_ENL",
        17,
        26,
        1,
        "rw",
        "float",
        "Over-subtraction factor of non-linear echo"
    ),
    p!(
        "PP_NLATTENONOFF",
        17,
        27,
        1,
        "rw",
        "int32",
        "Non-Linear echo attenuation. 0/1"
    ),
    p!(
        "PP_NLAEC_MODE",
        17,
        28,
        1,
        "rw",
        "int32",
        "Non-Linear AEC training mode. 0/1/2"
    ),
    p!(
        "PP_FMIN_SPEINDEX",
        17,
        30,
        1,
        "rw",
        "float",
        "Minimum frequency used for double-talk detection"
    ),
    p!(
        "PP_DTSENSITIVE",
        17,
        31,
        1,
        "rw",
        "int32",
        "Tradeoff between echo suppression and doubletalk"
    ),
    p!(
        "PP_ATTNS_MODE",
        17,
        32,
        1,
        "rw",
        "int32",
        "Additional AGC reduction during non-speech. 0/1"
    ),
    p!(
        "PP_ATTNS_NOMINAL",
        17,
        33,
        1,
        "rw",
        "float",
        "Non-speech attenuation at nominal speech level"
    ),
    p!(
        "PP_ATTNS_SLOPE",
        17,
        34,
        1,
        "rw",
        "float",
        "Extra attenuation slope during non-speech"
    ),
];

pub fn find(name: &str) -> Option<&'static Parameter> {
    PARAMETERS
        .iter()
        .find(|p| p.name.eq_ignore_ascii_case(name))
}

pub fn response_length(param: &Parameter) -> usize {
    // 1 byte of status followed by N elements of the parameter data type.
    let per = match param.kind {
        "uint8" | "char" => 1,
        "uint16" => 2,
        "float" | "radians" | "uint32" | "int32" => 4,
        _ => 4,
    };
    1 + (param.length as usize) * per
}
