export interface QuestionMetadata {
    lop_ma: string;
    lop_ten: string;
    mon_ma: string;
    mon_ten: string;
    phan_mon_ten: string; // New field: "Đại số", "Hình học", etc.
    chuong: number;
    chuong_ten: string; // New field for Chapter Name
    muc_do_ma: string; // N, H, V, C
    muc_do_ten: string;
    dang_bai: number;
    stt: number;
}

export type QuestionType = 'trac_nghiem_mot_dap_an' | 'trac_nghiem_dung_sai' | 'tra_loi_ngan' | 'tu_luan';

export interface QuestionNode {
    unique_id: string;
    classification_id: string;
    metadata: QuestionMetadata;
    question_type: QuestionType;
    latex_block: string;
    // New Parsed Fields
    content?: string; // The stem of the question (without options)
    options?: { id: string; content: string; isCorrect: boolean }[];
    short_answer?: string;
    explanation?: string;
    // Cache for pre-rendered graphics [original_latex -> svg_string]
    cached_tikz?: Record<string, string>;

    // RBAC & Workflow Fields
    status?: 'active' | 'pending' | 'archived' | 'rejected';
    created_by?: string; // User ID
    created_at?: number; // Timestamp
    approved_by?: string; // User ID
    flag_reason?: string; // If reported

    // Additional Fields (Fixing Types)
    correct_answer?: string;
    tags?: string[];
    answer_key?: string;
    children?: QuestionNode[];
    ownerId?: string;
    updatedAt?: string;
    updatedBy?: string;
}

export interface MatrixItem {
    count: number;
    lop: string; // '*' or specific
    mon: string;
    chuong: string;
    muc_do: string;
    dang_bai: string;
    loai_cau_hoi: string; // TN, DS, TLN, TL
}

export interface ExamMatrix {
    metadata: Record<string, string>;
    structure: MatrixItem[];
}

export enum UserRole {
    ADMIN = 'ADMIN',
    TEACHER = 'TEACHER',
    HEAD = 'HEAD',
    PARENT = 'PARENT'
}

export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    displayName?: string;
    photoURL?: string;
    code?: string;
    createdAt?: any;
    updatedAt?: any;
    [key: string]: any;
}
