
import { UserRole } from '../shared/types';

export const ID_COMPONENTS = {
    lop: { '6': '6', '7': '7', '8': '8', '9': '9', '0': '10', '1': '11', '2': '12' },
    mon: { 'D': 'Đại số & Giải tích', 'H': 'Hình học', 'C': 'Chuyên đề' },
    muc_do: { 'N': 'Nhận biết', 'H': 'Thông hiểu', 'V': 'Vận dụng', 'C': 'Vận dụng cao' }
};

export const KNOWLEDGE_MAP: any = {
    "6": {
        "D": { "name": "Số học 6", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) },
        "H": { "name": "Hình học 6", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) }
    },
    "7": {
        "D": { "name": "Đại số 7", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) },
        "H": { "name": "Hình học 7", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) }
    },
    "8": {
        "D": { "name": "Đại số 8", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) },
        "H": { "name": "Hình học 8", "chapters": Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) }
    },
    "9": {
        "D": { "name": "Đại số 9", "chapters": Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) },
        "H": { "name": "Hình 9", "chapters": Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` })) }
    },
    "10": {
        "D": {
            "name": "Đại số & Thống kê 10",
            "chapters": [
                { "id": 1, "name": "Chương 1. Mệnh đề. Tập hợp" },
                { "id": 2, "name": "Chương 2. BPT và hệ BPT bậc nhất hai ẩn" },
                { "id": 3, "name": "Chương 3. Hàm số bậc hai và đồ thị" },
                { "id": 6, "name": "Chương 6. Thống kê" },
                { "id": 7, "name": "Chương 7. BPT bậc 2 một ẩn" },
                { "id": 8, "name": "Chương 8. Đại số tổ hợp" },
                { "id": 10, "name": "Chương 10. Xác suất" }
            ]
        },
        "H": {
            "name": "Hình học 10",
            "chapters": [
                { "id": 4, "name": "Chương 4. Hệ thức lượng trong tam giác" },
                { "id": 5, "name": "Chương 5. Véctơ" },
                { "id": 9, "name": "Chương 9. Phương pháp toạ độ trong mặt phẳng (Oxy)" }
            ]
        },
        "C": {
            "name": "Chuyên đề 10",
            "chapters": Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` }))
        }
    },
    "11": {
        "D": {
            "name": "Đại số & Giải tích 11",
            "chapters": [
                { "id": 1, "name": "Chương 1. Hàm số lượng giác và PT lượng giác" },
                { "id": 2, "name": "Chương 2. Dãy số. Cấp số cộng/nhân" },
                { "id": 3, "name": "Chương 3. Giới hạn. Hàm số liên tục" },
                { "id": 5, "name": "Chương 5. Số đặc trưng của mẫu số liệu" },
                { "id": 6, "name": "Chương 6. Hàm số mũ và Logarit" },
                { "id": 7, "name": "Chương 7. Đạo hàm" },
                { "id": 9, "name": "Chương 9. Xác suất" }
            ]
        },
        "H": {
            "name": "Hình học 11",
            "chapters": [
                { "id": 4, "name": "Chương 4. Quan hệ song song trong không gian" },
                { "id": 8, "name": "Chương 8. Quan hệ vuông góc trong không gian" }
            ]
        },
        "C": {
            "name": "Chuyên đề 11",
            "chapters": Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` }))
        }
    },
    "12": {
        "D": {
            "name": "Giải tích 12",
            "chapters": [
                { "id": 1, "name": "Chương 1. Ứng dụng đạo hàm" },
                { "id": 3, "name": "Chương 3. Số đặc trưng mẫu số liệu" },
                { "id": 4, "name": "Chương 4. Nguyên hàm, tích phân" },
                { "id": 6, "name": "Chương 6. Xác suất" }
            ]
        },
        "H": {
            "name": "Hình học 12",
            "chapters": [
                { "id": 2, "name": "Chương 2. Tọa độ véc-tơ không gian" },
                { "id": 5, "name": "Chương 5. PT mặt phẳng, đường thẳng, mặt cầu" }
            ]
        },
        "C": {
            "name": "Chuyên đề 12",
            "chapters": Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `Chương ${i + 1}` }))
        }
    }
};

export const getNavItems = (role: UserRole) => {
    let navItems = [
        { label: 'Tổng quan', path: '/', icon: '📊' },
        { label: 'Cài đặt', path: '/settings', icon: '⚙️' },
    ];

    if (role === UserRole.ADMIN) {
        navItems = [
            { label: 'Dashboard', path: '/', icon: '🛡️' },
            { label: 'Quản lý bài tập', path: '/assignments', icon: '📝' },
            { label: 'Ngân hàng câu hỏi', path: '/question-bank', icon: '📚' },
            { label: 'Người dùng', path: '/users', icon: '👥' },
            { label: 'Lớp học', path: '/classes', icon: '🏫' },
        ];
    } else if (role === UserRole.TEACHER) {
        navItems = [
            { label: 'Tổng quan', path: '/', icon: '📊' },
            { label: 'Quản lý bài tập', path: '/assignments', icon: '📝' },
            { label: 'Ngân hàng câu hỏi', path: '/question-bank', icon: '📚' },
        ];
    } else if (role === UserRole.HEAD) {
        navItems = [
            { label: 'Tổng quan', path: '/', icon: '📊' },
            { label: 'Ngân hàng câu hỏi', path: '/question-bank', icon: '📚' },
        ];
    } else if (role === UserRole.PARENT) {
        navItems = [
            { label: 'Tổng quan', path: '/', icon: '👨‍👩‍👧‍👦' },
        ];
    }
    return navItems;
};
