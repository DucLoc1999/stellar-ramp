import { Bot, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { telegramConfig } from '../config/app';
import paymentService from './paymentService';
import paymentInformationService from './paymentInformationService';
import teleUserService from './teleUserService';
import kycService from './kycService';
import fptAiVisionService from './fptAiVisionService';
import s3Service from './s3Service';
import referralService from './referralService';
import { logger } from '../config/logger';
import { captureErrorWithContext } from '../utils/sentryHelper';
import { banks } from '../models/webhook';
import type { PaymentInformation, Kyc } from '../models/types';
import fs from 'fs';
import path from 'path';

/**
 * Message Templates (Vietnamese)
 */
export const Messages = {
  WELCOME: (firstName: string) =>
    `👋 Xin chào <b>${firstName}</b>!\n\n` +
    `🤖 Chào mừng bạn đến với Bot Mua/Bán USDT tự động!\n\n` +
    `💰 Tỷ giá cạnh tranh nhất thị trường\n` +
    `⚡️ Giao dịch nhanh chóng, an toàn\n` +
    `🔒 Bảo mật tuyệt đối\n\n` +
    `Vui lòng chọn chức năng bên dưới:`,

  RATE_CHECK: (buyRate: number, sellRate: number, updated: string) =>
    `💱 <b>TỶ GIÁ USDT HIỆN TẠI</b>\n\n` +
    `📈 Giá mua: <b>${buyRate.toLocaleString('vi-VN')} VND</b>\n` +
    `📉 Giá bán: <b>${sellRate.toLocaleString('vi-VN')} VND</b>\n\n` +
    `🕐 Cập nhật: ${updated}\n\n` +
    `💡 Tỷ giá được cập nhật liên tục`,

  RATE_UNAVAILABLE: () =>
    `⚠️ <b>Không thể lấy tỷ giá</b>\n\n` +
    `Hệ thống đang bảo trì hoặc có lỗi kết nối.\n` +
    `Vui lòng thử lại sau ít phút.`,

  BUY_SELECT_AMOUNT: () => `💰 <b>MUA USDT</b>\n\n` + `Vui lòng chọn số lượng USDT muốn mua:`,

  SELL_SELECT_AMOUNT: () => `💸 <b>BÁN USDT</b>\n\n` + `Vui lòng chọn số lượng USDT muốn bán:`,

  ENTER_CUSTOM_AMOUNT_BUY: () =>
    `✏️ Vui lòng nhập số lượng USDT muốn mua:\n\n` + `📊 Ví dụ: 10, 50, 100`,

  ENTER_CUSTOM_AMOUNT_SELL: () =>
    `✏️ Vui lòng nhập số lượng USDT muốn bán:\n\n` + `📊 Ví dụ: 10, 50, 100`,

  ENTER_WALLET_ADDRESS: () =>
    `📮 <b>NHẬP ĐỊA CHỈ VÍ</b>\n\n` +
    `Vui lòng nhập địa chỉ ví BSC (BEP-20) để nhận USDT:\n\n` +
    `⚠️ Lưu ý: Kiểm tra kỹ địa chỉ ví trước khi gửi!`,

  SELECT_BANK: () => `🏦 <b>CHỌN NGÂN HÀNG</b>\n\n` + `Vui lòng chọn ngân hàng nhận tiền VND:`,

  ENTER_FULL_NAME: () =>
    `👤 <b>NHẬP TÊN TÀI KHOẢN</b>\n\n` +
    `Vui lòng nhập họ tên chủ tài khoản ngân hàng:\n\n` +
    `📝 Ví dụ: Nguyen Van A`,

  ENTER_ACCOUNT_NUMBER: () =>
    `💳 <b>NHẬP SỐ TÀI KHOẢN</b>\n\n` +
    `Vui lòng nhập số tài khoản ngân hàng:\n\n` +
    `📝 Ví dụ: 1234567890`,

  ENTER_BANK_DETAILS_SINGLE: () =>
    `🏦 <b>NHẬP THÔNG TIN NGÂN HÀNG</b>\n\n` +
    `Vui lòng nhập thông tin theo định dạng:\n\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>\n\n` +
    `📝 Ví dụ: VIETCOMBANK, NGUYEN VAN A, 1234567890\n\n` +
    `⚠️ Lưu ý:\n` +
    `• Tên ngân hàng và họ tên không được chứa số\n` +
    `• Số tài khoản chỉ chứa chữ số\n` +
    `• Phân cách bằng dấu phẩy (,)`,

  INVALID_AMOUNT: () => `❌ Số lượng không hợp lệ!\n\n` + `Vui lòng nhập số hợp lệ (VD: 100)`,

  INVALID_WALLET: () =>
    `❌ Địa chỉ ví không hợp lệ!\n\n` + `Vui lòng nhập địa chỉ ví BSC hợp lệ (0x...)`,

  INVALID_FULL_NAME: () =>
    `❌ Tên tài khoản không hợp lệ!\n\n` + `Vui lòng nhập họ tên đầy đủ (VD: Nguyen Van A)`,

  INVALID_ACCOUNT_NUMBER: () =>
    `❌ Số tài khoản không hợp lệ!\n\n` + `Vui lòng nhập số tài khoản hợp lệ (chỉ chứa số)`,

  INVALID_BANK_DETAILS_FORMAT: () =>
    `❌ <b>Định dạng không hợp lệ!</b>\n\n` +
    `Vui lòng nhập theo mẫu:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>\n\n` +
    `📝 Ví dụ: VIETCOMBANK, NGUYEN VAN A, 1234567890`,

  INVALID_BANK_NAME_HAS_NUMBERS: () =>
    `❌ <b>Tên ngân hàng không được chứa số!</b>\n\n` +
    `Vui lòng nhập lại theo định dạng:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>`,

  INVALID_FULL_NAME_HAS_NUMBERS: () =>
    `❌ <b>Họ tên không được chứa số!</b>\n\n` +
    `Vui lòng nhập lại theo định dạng:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>`,

  BANK_NOT_FOUND: () =>
    `❌ <b>Không tìm thấy ngân hàng!</b>\n\n` +
    `Vui lòng kiểm tra lại tên ngân hàng.\n\n` +
    `💡 Gợi ý: VIETCOMBANK, TECHCOMBANK, BIDV, AGRIBANK, VCB, TCB, MB, ACB, VPB, TPB, SACOMBANK, HDBANK, SHB, VIB, MSB, OCB, EXIMBANK, SCB, SEABANK, ABBANK, VIETINBANK, LIENVIETPOSTBANK, PVCOMBANK, BAOVIETBANK, GPBANK, NAMABANK, PGBANK, VIETABANK, VIETBANK, OCEANBANK, CBBANK, KIENLONGBANK, DONGABANK, WOORIBANK, PUBLICBANK, NONGHYUP, INDOVINABANK, SHINHAN, STANDARDCHARTERED, ANZ, HSBC, HONGKONG, CIMB, UOB, MAYBANK, BANGKOK, MIZUHO, MUFG, SMBC, DEUTSCHE, BNP, CITIBANK`,

  ORDER_SUMMARY_BUY: (
    usdtAmount: string,
    wallet: string,
    vndAmount: number,
    buyRate: number,
    gatewayFee: number
  ) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - MUA USDT</b>\n\n` +
    `Đơn hàng MUA <b>${usdtAmount} USDT</b> x <b>${buyRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: BSC | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${Math.round(vndAmount).toLocaleString('vi-VN')}đ</b> | 💳 Phí dịch vụ: <b>${Math.round(gatewayFee).toLocaleString('vi-VN')}đ</b>\n` +
    `📮 Ví nhận: <code>${wallet}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi thanh toán!`,

  ORDER_SUMMARY_SELL: (amount: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `💎 Số lượng: <b>${amount} USDT</b>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi chuyển USDT!`,

  SELL_CONFIRMATION: (
    amount: string,
    bankName: string,
    fullName: string,
    accountNumber: string,
    sellRate: number,
    totalVND: number,
    serviceFee: number
  ) =>
    `💸 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `Đơn hàng BÁN <b>${amount} USDT</b> x <b>${sellRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: BSC | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${Math.round(totalVND - serviceFee).toLocaleString('vi-VN')}đ</b> |  💳 Phí dịch vụ: <b>${Math.round(serviceFee).toLocaleString('vi-VN')}đ</b>\n` +
    `🏦 Bank nhận: <code>${bankName}</code> | <code>${accountNumber}</code> | <code>${fullName}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi xác nhận!`,

  PAYMENT_QR_MESSAGE: (
    bankName?: string,
    accountNumber?: string,
    accountName?: string,
    vndAmount?: number
  ) => {
    let message = `🏦 <b>THÔNG TIN CHUYỂN KHOẢN</b>\n\n`;

    if (bankName && accountNumber && accountName) {
      message += `🏛️ Ngân hàng: <b>${bankName}</b>\n`;
      message += `💳 Số tài khoản: <code>${accountNumber}</code>\n`;
      message += `👤 Chủ tài khoản: <b>${accountName}</b>\n\n`;
    }

    if (vndAmount) {
      message += `💰 Số tiền: <code>${Math.round(vndAmount).toLocaleString('vi-VN')}đ</code>\n\n`;
    }

    message += `💰 Vui lòng quét mã QR bên dưới để thanh toán`;
    return message;
  },

  PAYMENT_QR_CAPTION: () =>
    `💳 Quét mã QR để thanh toán\n\n` +
    `⏰ Sau khi thanh toán, USDT sẽ được chuyển vào ví của bạn trong vòng 3-30 giây.\n\n` +
    `📞 Liên hệ support nếu có vấn đề!`,

  PAYMENT_SELL_ADDRESS: (recipientAddress: string, usdtAmount?: string) =>
    `📮 <b>ĐỊA CHỈ VÍ NHẬN USDT</b>\n\n` +
    (usdtAmount ? `💰 Số lượng: <code>${usdtAmount} USDT</code>\n\n` : '') +
    `Vui lòng chuyển USDT đến địa chỉ:\n\n` +
    `<code>${recipientAddress}</code>\n\n` +
    `🌐 Mạng: <b>BNB Chain (BSC)</b>\n` +
    `💎 Token: <b>USDT (BEP-20)</b>\n\n` +
    `⏰ Sau khi chuyển, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 3-30 giây.\n\n` +
    `⚠️ Lưu ý: Chỉ chuyển USDT trên mạng BSC!`,

  PAYMENT_CANCELLED: () =>
    `❌ <b>ĐÃ HỦY THANH TOÁN</b>\n\n` +
    `Đơn hàng đã được hủy.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  ORDER_CANCELLED: () =>
    `✅ <b>ĐÃ HỦY ĐƠN HÀNG</b>\n\n` +
    `Đơn hàng của bạn đã được hủy thành công.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  ORDER_CANCEL_FAILED: (reason?: string) =>
    `❌ <b>KHÔNG THỂ HỦY ĐƠN HÀNG</b>\n\n` +
    `${reason || 'Đơn hàng không thể hủy (có thể đã hoàn thành hoặc hết hạn).'}\n\n` +
    `Vui lòng liên hệ support nếu cần hỗ trợ!`,

  SELECT_SAVED_WALLET: () =>
    `🔑 <b>CHỌN ĐỊA CHỈ VÍ</b>\n\n` +
    `Bạn có các địa chỉ ví đã lưu. Vui lòng chọn một địa chỉ hoặc thêm địa chỉ mới:`,

  SELECT_SAVED_BANK_ACCOUNT: () =>
    `🏦 <b>CHỌN TÀI KHOẢN NGÂN HÀNG</b>\n\n` +
    `Bạn có các tài khoản ngân hàng đã lưu. Vui lòng chọn một tài khoản hoặc thêm tài khoản mới:`,

  CONFIRM_DELETE_BANK: (bankName: string, accountNumber: string, fullName?: string) =>
    `⚠️ <b>XÁC NHẬN XÓA</b>\n\n` +
    `Bạn có chắc muốn xóa tài khoản ngân hàng?\n\n` +
    `🏛️ Ngân hàng: <b>${bankName}</b>\n` +
    `💳 Số TK: <code>${accountNumber}</code>\n` +
    (fullName ? `👤 Chủ TK: <b>${fullName}</b>\n` : '') +
    `\n⚠️ Hành động này không thể hoàn tác!`,

  CONFIRM_DELETE_WALLET: (walletAddress: string) =>
    `⚠️ <b>XÁC NHẬN XÓA</b>\n\n` +
    `Bạn có chắc muốn xóa địa chỉ ví?\n\n` +
    `📮 Địa chỉ: <code>${walletAddress}</code>\n\n` +
    `⚠️ Hành động này không thể hoàn tác!`,

  DELETE_SUCCESS: () =>
    `✅ <b>ĐÃ XÓA THÀNH CÔNG</b>\n\n` + `Thông tin thanh toán đã được xóa khỏi hệ thống.`,

  DELETE_FAILED: () =>
    `❌ <b>XÓA THẤT BẠI</b>\n\n` +
    `Không thể xóa thông tin thanh toán.\n` +
    `Vui lòng thử lại hoặc liên hệ support!`,

  ENTER_DELETE_BANK_INDEX: (accounts: any[]) => {
    let message = `🗑️ <b>XÓA TÀI KHOẢN NGÂN HÀNG</b>\n\n`;
    message += `Danh sách tài khoản:\n\n`;

    accounts.forEach((account, index) => {
      const bank = banks.find((b) => b.id === account.bank_id);
      const bankName = bank ? bank.short_name : 'N/A';

      message += `<b>${index + 1}. ${account.full_name || 'N/A'}</b>\n`;
      message += `   🏛️ Ngân hàng: ${bankName}\n`;
      message += `   💳 Số TK: <code>${account.bank_account || 'N/A'}</code>\n\n`;
    });

    message += `Vui lòng nhập số thứ tự tài khoản muốn xóa (ví dụ: 1, 2):`;
    return message;
  },

  ENTER_DELETE_WALLET_INDEX: (wallets: any[]) => {
    let message = `🗑️ <b>XÓA VÍ CRYPTO</b>\n\n`;
    message += `Danh sách ví:\n\n`;

    wallets.forEach((wallet, index) => {
      const address = wallet.wallet_address || 'N/A';

      message += `<b>${index + 1}.</b> <code>${address}</code>\n`;
    });

    message += `\nVui lòng nhập số thứ tự ví muốn xóa (ví dụ: 1, 2):`;
    return message;
  },

  INVALID_DELETE_INDEX: () =>
    `❌ <b>SỐ THỨ TỰ KHÔNG HỢP LỆ</b>\n\n` + `Vui lòng nhập một số hợp lệ từ danh sách.`,

  KYC_REQUIRED: () =>
    `🔐 <b>YÊU CẦU XÁC MINH KYC</b>\n\n` +
    `Bạn cần xác minh danh tính (KYC) để thực hiện giao dịch.\n\n` +
    `📞 Vui lòng liên hệ support để được hướng dẫn!`,

  KYC_REQUIRED_FOR_TRADING: () =>
    `🔐 <b>YÊU CẦU XÁC MINH DANH TÍNH</b>\n\n` +
    `Để đảm bảo an toàn và tuân thủ quy định, bạn cần hoàn thành xác minh danh tính (KYC) trước khi mua/bán USDT.\n\n` +
    `<b>Lợi ích của KYC:</b>\n` +
    `✅ Bảo vệ tài khoản của bạn\n` +
    `✅ Tuân thủ quy định pháp luật\n` +
    `✅ Giao dịch an toàn và minh bạch\n` +
    `✅ Hạn mức giao dịch cao hơn\n\n` +
    `<b>Quy trình KYC nhanh chóng:</b>\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Chụp ảnh CCCD/CMND/Passport\n\n` +
    `⏱️ Chỉ mất 2-3 phút để hoàn thành!\n\n` +
    `Nhấn nút bên dưới để bắt đầu xác minh ngay.`,

  KYC_INFO: () =>
    `🔐 <b>XÁC MINH DANH TÍNH (KYC)</b>\n\n` +
    `Để đảm bảo an toàn và tuân thủ quy định, chúng tôi yêu cầu xác minh danh tính cho các giao dịch lớn.\n\n` +
    `<b>Quy trình KYC:</b>\n\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Cung cấp CCCD/CMND/Passport\n\n` +
    `📞 Liên hệ support để được hướng dẫn chi tiết!`,

  KYC_NOT_COMPLETED: () =>
    `🔐 <b>XÁC MINH DANH TÍNH (KYC)</b>\n\n` +
    `Bạn chưa hoàn thành xác minh danh tính.\n\n` +
    `Để sử dụng đầy đủ các tính năng giao dịch, vui lòng hoàn thành quy trình KYC.\n\n` +
    `<b>Quy trình KYC bao gồm:</b>\n\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Cung cấp thông tin CCCD/CMND/Passport\n\n` +
    `Nhấn nút bên dưới để bắt đầu!`,

  KYC_COMPLETED: (kyc: Kyc) => {
    return (
      `✅ <b>THÔNG TIN KYC</b>\n\n` +
      `Quý khách đã hoàn thành KYC với tên: <b>${kyc.name}</b> - <code>${kyc.phone}</code>\n\n` +
      `💡 Thông tin KYC của bạn đã được xác minh và mã hoá bằng công nghệ zk.`
    );
  },

  KYC_REQUEST_PHONE: () =>
    `📱 <b>XÁC MINH SỐ ĐIỆN THOẠI</b>\n\n` +
    `Vui lòng chia sẻ số điện thoại của bạn để tiếp tục.\n\n` +
    `Nhấn nút "📱 Chia sẻ số điện thoại" bên dưới để chia sẻ số điện thoại từ Telegram.`,

  KYC_INVALID_PHONE: () =>
    `❌ <b>SỐ ĐIỆN THOẠI KHÔNG HỢP LỆ</b>\n\n` +
    `Vui lòng nhập số điện thoại hợp lệ.\n\n` +
    `📝 Định dạng chấp nhận:\n` +
    `• 0xxxxxxxxx (10 chữ số)\n` +
    `• +84xxxxxxxxx (bắt đầu với +84)\n\n` +
    `Vui lòng thử lại!`,

  KYC_PHONE_RECEIVED: (phoneNumber: string) =>
    `✅ <b>ĐÃ NHẬN SỐ ĐIỆN THOẠI</b>\n\n` +
    `📱 Số điện thoại: <code>${phoneNumber}</code>\n\n` +
    `Cảm ơn bạn! Chúng tôi sẽ tiếp tục với các bước tiếp theo của quy trình KYC.`,

  KYC_SELECT_DOCUMENT_TYPE: () =>
    `📄 <b>CHỌN LOẠI GIẤY TỜ</b>\n\n` +
    `Vui lòng chọn loại giấy tờ bạn muốn sử dụng để xác minh danh tính:\n\n` +
    `🆔 <b>CMND/CCCD</b> - Chứng minh nhân dân / Căn cước công dân\n` +
    `🛂 <b>Hộ chiếu</b> - Passport\n\n` +
    `Nhấn nút bên dưới để chọn:`,

  KYC_REQUEST_ID_CARD: () =>
    `📸 <b>CHỤP ẢNH CCCD</b>\n\n` +
    `Vui lòng gửi ảnh <b>mặt trước</b> của Căn cước công dân (CCCD) của bạn.\n\n` +
    `📝 <b>Lưu ý:</b>\n` +
    `• Ảnh phải rõ nét, không bị mờ\n` +
    `• Đảm bảo đầy đủ 4 góc của CCCD\n` +
    `• Không chụp qua màn hình\n` +
    `• Ánh sáng đủ, không bị lóa\n\n` +
    `📷 Nhấn nút 📎 và chọn ảnh từ thư viện hoặc chụp ảnh mới.`,

  KYC_REQUEST_PASSPORT: () =>
    `📸 <b>CHỤP ẢNH HỘ CHIẾU</b>\n\n` +
    `Vui lòng gửi ảnh <b>trang thông tin cá nhân</b> của Hộ chiếu (Passport) của bạn.\n\n` +
    `📝 <b>Lưu ý:</b>\n` +
    `• Ảnh phải rõ nét, không bị mờ\n` +
    `• Đảm bảo đầy đủ thông tin trên trang\n` +
    `• Không chụp qua màn hình\n` +
    `• Ánh sáng đủ, không bị lóa\n\n` +
    `📷 Nhấn nút 📎 và chọn ảnh từ thư viện hoặc chụp ảnh mới.`,

  KYC_PROCESSING_IMAGE: () =>
    `🤖 <b>AI ĐANG XỬ LÝ ẢNH...</b>\n\n` +
    `Vui lòng đợi trong giây lát, AI của chúng tôi đang tự động phân tích thông tin từ giấy tờ của bạn.`,

  KYC_ID_CARD_EXTRACTED: (idData: any, documentType: 'cccd' | 'passport' = 'cccd') => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          return `${parts[0]}/${parts[1]}/${parts[2]}`;
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    };

    // Parse sex field for display (extract Vietnamese part)
    // API returns different formats: CCCD="NAM"/"NỮ", Passport="NAM/M"/"NỮ/F"
    const formatSex = (sex: string | undefined) => {
      if (!sex) return 'N/A';
      const parts = sex.split('/');
      return parts[0] || sex; // Return Vietnamese part (e.g., "NAM" or "NỮ")
    };

    // Passport format
    if (documentType === 'passport') {
      return (
        `✅ <b>THÔNG TIN ĐÃ TRÍCH XUẤT</b>\n\n` +
        `Vui lòng kiểm tra thông tin bên dưới:\n\n` +
        `🛂 Số hộ chiếu: <code>${idData.passport_number || 'N/A'}</code>\n` +
        `🆔 Số CCCD: <code>${idData.id_number || idData.id || 'N/A'}</code>\n` +
        `👤 Họ tên: <b>${idData.name || 'N/A'}</b>\n` +
        `🎂 Ngày sinh: ${formatDate(idData.dob)}\n` +
        `⚧️ Giới tính: ${formatSex(idData.sex)}\n` +
        `🌍 Quốc tịch: ${idData.nationality || 'N/A'}\n` +
        `🏠 Nơi sinh: ${idData.pob || 'N/A'}\n` +
        `📅 Ngày hết hạn: ${formatDate(idData.doe)}\n\n` +
        `❓ Thông tin có chính xác không?`
      );
    }

    // CCCD format (default)
    return (
      `✅ <b>THÔNG TIN ĐÃ TRÍCH XUẤT</b>\n\n` +
      `Vui lòng kiểm tra thông tin bên dưới:\n\n` +
      `🆔 Số CCCD: <code>${idData.id || 'N/A'}</code>\n` +
      `👤 Họ tên: <b>${idData.name || 'N/A'}</b>\n` +
      `🎂 Ngày sinh: ${formatDate(idData.dob)}\n` +
      `⚧️ Giới tính: ${formatSex(idData.sex)}\n` +
      `🌍 Quốc tịch: ${idData.nationality || 'N/A'}\n` +
      `🏠 Quê quán: ${idData.home || 'N/A'}\n` +
      `📍 Địa chỉ: ${idData.address || 'N/A'}\n` +
      `📅 Ngày hết hạn: ${formatDate(idData.doe)}\n\n` +
      `❓ Thông tin có chính xác không?`
    );
  },

  KYC_IMAGE_ERROR: () =>
    `❌ <b>LỖI XỬ LÝ ẢNH</b>\n\n` +
    `Không thể trích xuất thông tin từ ảnh CCCD.\n\n` +
    `<b>Nguyên nhân có thể:</b>\n` +
    `• Ảnh không rõ nét hoặc bị mờ\n` +
    `• Không phải ảnh CCCD hợp lệ\n` +
    `• Ảnh bị che khuất hoặc thiếu góc\n` +
    `• Ánh sáng không đủ\n\n` +
    `Vui lòng chụp lại ảnh CCCD của bạn.`,

  KYC_SAVE_SUCCESS: (name: string, phoneNumber: string) =>
    `🎉 <b>HOÀN TẤT KYC</b>\n\n` +
    `✅ Thông tin KYC của bạn đã được lưu thành công!\n\n` +
    `👤 Họ tên: <b>${name}</b>\n` +
    `📱 Số điện thoại: <b>${phoneNumber}</b>\n\n` +
    `💡 Thông tin KYC của bạn đã được xác minh và mã hoá bằng công nghệ zk.`,

  KYC_SAVE_ERROR: () =>
    `❌ <b>LỖI LƯU THÔNG TIN</b>\n\n` +
    `Có lỗi xảy ra khi lưu thông tin KYC của bạn.\n\n` +
    `Vui lòng thử lại hoặc liên hệ support để được hỗ trợ.`,

  KYC_ID_ALREADY_REGISTERED: (idNumberLast4: string) =>
    `⚠️ <b>SỐ CCCD ĐÃ ĐƯỢC ĐĂNG KÝ</b>\n\n` +
    `Số CCCD này (***${idNumberLast4}) đã được đăng ký với một tài khoản Telegram khác.\n\n` +
    `<b>Lưu ý:</b>\n` +
    `• Mỗi số CCCD chỉ có thể xác minh cho một tài khoản duy nhất\n` +
    `• Điều này nhằm đảm bảo an toàn và tuân thủ quy định\n\n` +
    `<b>Bạn có thể:</b>\n` +
    `• Sử dụng CCCD khác để xác minh\n` +
    `• Liên hệ support nếu bạn cho rằng đây là lỗi\n` +
    `• Liên hệ support nếu cần chuyển xác minh sang tài khoản này\n\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  KYC_ATTEMPTS_EXCEEDED: () =>
    `🚫 <b>VƯỢT QUÁ SỐ LẦN XÁC MINH</b>\n\n` +
    `Bạn đã vượt quá số lần xác minh KYC cho phép.\n\n` +
    `Vui lòng liên hệ bộ phận hỗ trợ để được giúp đỡ.`,

  ACCOUNT_INFO: (
    chatId: number,
    firstName: string,
    lastName: string | null,
    username: string,
    isKyc: boolean,
    savedBankAccounts: PaymentInformation[],
    savedWallets: PaymentInformation[],
    phoneNumber?: string | null
  ) => {
    let message =
      `👤 <b>THÔNG TIN TÀI KHOẢN</b>\n\n` +
      `🆔 Chat ID: <code>${chatId}</code>\n` +
      `👤 Họ tên: ${firstName}${lastName ? ' ' + lastName : ''}\n` +
      `📱 Username: ${username ? '@' + username : 'Chưa có'}\n`;

    // Add phone number only if KYC is verified and phone number exists
    if (isKyc && phoneNumber) {
      message += `📞 Số điện thoại: <code>${phoneNumber}</code>\n`;
    }

    message +=
      `🔐 Trạng thái KYC: ${isKyc ? '✅ Đã xác minh' : '❌ Chưa xác minh'}\n\n` +
      `💳 <b>THÔNG TIN THANH TOÁN ĐÃ LƯU</b>\n\n`;

    // Add bank accounts section
    if (savedBankAccounts.length > 0) {
      message += `🏦 <b>Ngân hàng:</b>\n`;
      savedBankAccounts.forEach((account) => {
        // Find bank name from banks array
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank ? bank.short_name : 'N/A';
        message += `• <code>${bankName} - ${account.full_name || 'N/A'} - ${account.bank_account || 'N/A'}</code>\n`;
      });
      message += '\n';
    }

    // Add crypto wallets section
    if (savedWallets.length > 0) {
      message += `💎 <b>Ví crypto:</b>\n`;
      savedWallets.forEach((wallet) => {
        if (wallet.wallet_address) {
          // Display full wallet address wrapped in code tags for easy copying
          message += `• <code>${wallet.wallet_address}</code>\n`;
        }
      });
      message += '\n';
    }

    // If no payment info exists
    if (savedBankAccounts.length === 0 && savedWallets.length === 0) {
      message += `Chưa có thông tin thanh toán đã lưu`;
    }

    return message.trim();
  },

  ORDER_STATUS_UPDATE: (orderId: string, status: string) =>
    `📢 <b>CẬP NHẬT ĐƠN HÀNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: <b>${status}</b>\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`,

  // Enhanced order state messages
  ORDER_STATE_CREATED: (orderId: string) =>
    `✅ <b>ĐƠN HÀNG ĐÃ TẠO</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã tạo\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng của bạn đã được tạo thành công!`,

  ORDER_STATE_PROCESSING: (orderId: string) =>
    `⏳ <b>ĐANG XỬ LÝ</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đang xử lý\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng của bạn đang được xử lý...`,

  ORDER_STATE_COMPLETED: (orderId: string) =>
    `🎉 <b>HOÀN THÀNH</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Hoàn thành\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `✨ Giao dịch đã hoàn tất thành công!\n` +
    `💰 Vui lòng kiểm tra ví của bạn.`,

  ORDER_STATE_FAILED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Giao dịch không thành công. Vui lòng liên hệ support để được hỗ trợ!`,

  ORDER_STATE_CANCELLED: (orderId: string) =>
    `🚫 <b>ĐÃ HỦY</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã hủy\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng đã được hủy.`,

  // Processing state messages
  PROCESSING_STATE_WAITING_FIAT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ bạn chuyển khoản VND.\n` +
    `📱 Vui lòng quét mã QR để thanh toán.`,

  PROCESSING_STATE_FIAT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ XÁC NHẬN CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND đã được xác nhận.\n` +
    `⏳ Đang xử lý chuyển USDT...`,

  PROCESSING_STATE_FIAT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN KHOẢN VND THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_USDT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN USDT</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ chuyển USDT vào ví của bạn...`,

  PROCESSING_STATE_USDT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ CHUYỂN USDT THÀNH CÔNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `🎉 USDT đã được chuyển vào ví của bạn!\n` +
    `💰 Vui lòng kiểm tra ví.`,

  PROCESSING_STATE_USDT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN USDT THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển USDT không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_ADMIN: (orderId: string) =>
    `⏳ <b>CHỜ ADMIN DUYỆT</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đơn hàng đang chờ admin duyệt.\n` +
    `⏰ Vui lòng đợi trong giây lát...`,

  REFERRAL_INFO: (username: string, referralCount: number, botUsername: string) =>
    `🎁 <b>CHƯƠNG TRÌNH GIỚI THIỆU BẠN BÈ</b>\n\n` +
    `👥 Số người bạn đã giới thiệu: <b>${referralCount}</b>\n\n` +
    `🔗 Link giới thiệu của bạn:\n` +
    `<code>https://t.me/${botUsername}?start=${username}</code>\n\n` +
    `💡 Chia sẻ link này với bạn bè để họ tham gia!\n` +
    `🎉 Mỗi người bạn giới thiệu sẽ được tính vào tổng số giới thiệu của bạn.`,
};

/**
 * Keyboard Layouts
 */
export class Keyboards {
  static async mainMenu(chatId: number): Promise<InlineKeyboard> {
    // Fetch user data to check KYC status
    const user = await teleUserService.findByChatId(chatId);
    const isKyc = user?.is_kyc ?? false;

    // Check if user has any saved bank accounts
    const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(chatId, 'BANK');
    const hasBankAccounts = savedBankAccounts.length > 0;

    // Check if user has any saved crypto wallets
    const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');
    const hasWallets = savedWallets.length > 0;

    // Status indicators
    const kycIndicator = isKyc ? '🟢' : '🔴';
    const bankIndicator = hasBankAccounts ? '🟢' : '🔴';
    const walletIndicator = hasWallets ? '🟢' : '🔴';

    return new InlineKeyboard()
      .text('💱 Kiểm tra tỷ giá', 'check_rate')
      .row()
      .text('💰 Mua USDT', 'buy_usdt')
      .text('💸 Bán USDT', 'sell_usdt')
      .row()
      .text(`🔐 Xác minh KYC ${kycIndicator}`, 'kyc')
      .text(`🏦 Ngân hàng ${bankIndicator}`, 'bank_accounts')
      .row()
      .text(`💎 Ví crypto ${walletIndicator}`, 'crypto_wallets')
      .text('👤 Tài khoản', 'account_info')
      .row()
      .text('🎁 Giới thiệu bạn bè', 'referral')
      .text('📞 Liên hệ hỗ trợ', 'contact_support');
  }

  static buyAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('10 USDT', 'buy_amount_10')
      .text('20 USDT', 'buy_amount_20')
      .row()
      .text('50 USDT', 'buy_amount_50')
      .text('✏️ Nhập số khác', 'buy_custom')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static sellAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('10 USDT', 'sell_amount_10')
      .text('50 USDT', 'sell_amount_50')
      .row()
      .text('100 USDT', 'sell_amount_100')
      .text('✏️ Nhập số khác', 'sell_custom')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static confirmPayment(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Xác nhận', 'confirm_payment')
      .row()
      .text('❌ Hủy', 'cancel_payment');
  }

  static backToMenu(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycStart(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🚀 Bắt đầu KYC', 'start_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycRequiredForTrading(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔐 Xác minh KYC ngay', 'start_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycPhoneRequest(): Keyboard {
    return new Keyboard().requestContact('📱 Chia sẻ số điện thoại').resized().oneTime();
  }

  static kycDocumentTypeSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🆔 CMND/CCCD', 'kyc_select_cccd')
      .row()
      .text('🛂 Hộ chiếu', 'kyc_select_passport')
      .row()
      .text('❌ Hủy', 'cancel_kyc');
  }

  static kycCancel(): InlineKeyboard {
    return new InlineKeyboard()
      .text('❌ Hủy', 'cancel_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycDuplicateIdError(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📸 Thử CCCD khác', 'kyc_try_different_id')
      .row()
      .text('📞 Liên hệ Support', 'contact_support')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycAttemptsExceeded(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📞 Liên hệ hỗ trợ', 'contact_support')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static qrCodeWithCancel(orderId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('❌ Hủy đơn hàng', `cancel_order_${orderId}`)
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static bankAccountsList(accounts: any[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add "Add New" and "Delete" buttons
    keyboard.text('➕ Thêm mới', 'add_bank_from_menu');

    // Only show delete button if there are accounts to delete
    if (accounts.length > 0) {
      keyboard.text('🗑️ Xóa ngân hàng', 'delete_bank_prompt');
    }

    keyboard.row();

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }

  static cryptoWalletsList(wallets: any[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add "Add New" and "Delete" buttons
    keyboard.text('➕ Thêm mới', 'add_wallet_from_menu');

    // Only show delete button if there are wallets to delete
    if (wallets.length > 0) {
      keyboard.text('🗑️ Xóa ví crypto', 'delete_wallet_prompt');
    }

    keyboard.row();

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }

  static confirmDelete(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Xác nhận xóa', 'confirm_delete')
      .row()
      .text('❌ Hủy', 'cancel_delete');
  }

  static bankSelection(offset: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Determine how many banks to show
    let banksToShow: typeof banks;
    let hasMore = false;

    if (offset === 0) {
      // First page: show first 5 banks
      banksToShow = banks.slice(0, 5);
      hasMore = banks.length > 5;
    } else {
      // Subsequent pages: show 5 banks
      const endIndex = Math.min(offset + 5, banks.length);
      banksToShow = banks.slice(offset, endIndex);
      hasMore = endIndex < banks.length;
    }

    // Add bank buttons (one per row)
    for (const bank of banksToShow) {
      keyboard.text(bank.short_name, `select_bank_${bank.id}`).row();
    }

    // Add "Show More" button if there are more banks
    if (hasMore) {
      const nextOffset = offset === 0 ? 5 : offset + 5;
      keyboard.text('📋 Xem thêm', `show_more_banks_${nextOffset}`).row();
    }

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }

  static savedWalletSelection(wallets: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add saved wallet buttons
    for (const wallet of wallets) {
      if (wallet.wallet_address) {
        // Format wallet address: 0x1234...5678
        const shortAddress = `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(38)}`;
        keyboard.text(`🔑 ${shortAddress}`, `use_saved_wallet_${wallet.id}`).row();
      }
    }

    // Add "Add new wallet" button
    keyboard.text('➕ Thêm địa chỉ ví mới', 'add_new_wallet').row();

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }

  static savedBankAccountSelection(accounts: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add saved bank account buttons
    for (const account of accounts) {
      if (account.bank_id && account.bank_account && account.full_name) {
        // Find bank name
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank?.short_name || 'Bank';

        // Format: [Bank Name] - [Account] - [Name]
        const label = `🏦 ${bankName} - ${account.bank_account} - ${account.full_name}`;
        keyboard.text(label, `use_saved_bank_${account.id}`).row();
      }
    }

    // Add "Add new bank account" button
    keyboard.text('➕ Thêm tài khoản ngân hàng mới', 'add_new_bank').row();

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }
}

/**
 * User State Management
 */
interface UserState {
  action?: 'buy' | 'sell' | 'kyc';
  amount?: string;
  walletAddress?: string;
  waitingFor?:
  | 'buy_amount'
  | 'sell_amount'
  | 'wallet'
  | 'bank_selection'
  | 'full_name'
  | 'account_number'
  | 'bank_details_single' // Single-input for bank details
  | 'delete_bank_index' // Waiting for bank account index to delete
  | 'delete_wallet_index' // Waiting for wallet index to delete
  | 'kyc_phone' // Waiting for phone number input
  | 'kyc_id_card' // Waiting for ID card photo
  | 'kyc_processing'; // Processing ID card photo (prevents duplicate processing)
  bankId?: number;
  bankName?: string;
  fullName?: string;
  accountNumber?: string;
  bankPageOffset?: number;
  paymentInfoId?: number; // ID of selected saved payment info
  isNewPaymentInfo?: boolean; // Flag to indicate if this is new payment info to be saved
  orderId?: string; // Order ID for cancellation
  savedBankAccounts?: any[]; // Saved bank accounts for deletion
  savedWallets?: any[]; // Saved wallets for deletion
  // KYC-related fields
  kycPhoneNumber?: string;
  kycDocumentType?: 'cccd' | 'passport'; // Type of document for KYC verification
  kycIdCardData?: any; // Extracted ID card data from FPT AI
  kycImageUrl?: string; // S3 URL of the uploaded KYC image
  lastProcessedPhotoId?: string; // Track last processed photo to prevent duplicates
}

// Track user-initiated order cancellations to prevent duplicate notifications
const userCancelledOrders = new Set<string>();

// Track newly created orders to skip initial PROCESSING webhook notification
// (we send the processing notification manually after QR code)
const newlyCreatedOrders = new Set<string>();

// Track users currently processing orders to prevent duplicate order creation
const processingUsers = new Set<number>();

// Track which message types have been sent for each order to prevent duplicates
// Map<orderId, Set<messageType>>
const sentMessages = new Map<string, Set<string>>();

const userStates = new Map<number, UserState>();

/**
 * Exchange Rate Interface
 */
interface ExchangeRate {
  buy: number;
  sell: number;
  created_at: string;
}

/**
 * Telegram Bot Service
 */
export class TelegramService {
  private bot: Bot;

  constructor() {
    if (!telegramConfig.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    this.bot = new Bot(telegramConfig.botToken);
    this.setupHandlers();
  }

  /**
   * Setup bot command and callback handlers
   */
  private setupHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      try {
        // Extract user information from Telegram context
        const chatId = ctx.chat?.id;
        const firstName = ctx.from?.first_name;
        const lastName = ctx.from?.last_name;
        const username = ctx.from?.username;

        if (!chatId || !firstName) {
          logger.error(
            { chatId, firstName },
            'Missing required user information in /start command'
          );
          await ctx.reply(
            `❌ <b>Lỗi khởi tạo</b>\n\n` +
            `Không thể lấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        // Extract referral parameter from deep link (e.g., /start thaingn)
        const referralUsername = ctx.match ? ctx.match.trim() : null;

        logger.info(
          { chatId, firstName, lastName, username, referralUsername },
          'Processing /start command'
        );

        // Check if user already exists
        const existingUser = await teleUserService.findByChatId(chatId);
        const isNewUser = !existingUser;

        // Prepare user data
        let referralToSave: number | undefined = undefined;

        // If new user and has referral parameter, save the referrer
        if (isNewUser && referralUsername) {
          // Find the referrer by username
          const referrer = await teleUserService.findByUsername(referralUsername);

          if (referrer) {
            logger.info(
              { chatId, referralUsername, referrerChatId: referrer.chat_id },
              'New user referred by existing user'
            );

            // Save referrer's chat_id in new user's record
            referralToSave = referrer.chat_id;

            // Increment referrer's referral count
            await teleUserService.incrementReferralCount(referrer.chat_id);

            logger.info(
              { referrerChatId: referrer.chat_id, referralUsername },
              'Incremented referral count for referrer'
            );

            // Save referral record to the referrals table
            await referralService.createReferral({
              chat_id: chatId, // The new user who was referred
              referral: referrer.chat_id, // The referrer
            });

            logger.info(
              { referredUserId: chatId, referrerId: referrer.chat_id },
              'Referral record saved to referrals table'
            );
          } else {
            logger.warn({ chatId, referralUsername }, 'Referral username not found in database');
          }
        }

        // Upsert user information to database
        await teleUserService.upsertUser({
          chat_id: chatId,
          first_name: firstName,
          last_name: lastName,
          username: username ?? '',
          referral: referralToSave,
        });

        logger.info({ chatId, isNewUser }, 'User information updated successfully');

        // Send welcome message
        await ctx.reply(Messages.WELCOME(firstName), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(chatId),
        });
      } catch (error) {
        logger.error({ error }, 'Error handling /start command');
        await ctx.reply(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Có lỗi xảy ra khi khởi động bot.\n\n` +
          `Vui lòng thử lại sau!`,
          { parse_mode: 'HTML' }
        );
      }
    });

    // Check rate callback
    this.bot.callbackQuery('check_rate', async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const rates = await this.fetchExchangeRates();
        if (rates) {
          const updated = new Date(rates.created_at).toLocaleString('vi-VN');
          await ctx.editMessageText(Messages.RATE_CHECK(rates.sell, rates.buy, updated), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } else {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
      } catch (error) {
        await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
    });

    // KYC callback - Check KYC status and display appropriate information
    this.bot.callbackQuery('kyc', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const chatId = ctx.chat?.id;

        if (!chatId) {
          logger.error('Missing chat ID in kyc callback');
          await ctx.editMessageText(
            `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Check if user has completed KYC
        logger.info({ chatId }, 'Checking KYC status');
        const kycRecord = await kycService.findByChatId(chatId);

        if (kycRecord) {
          // User has completed KYC - display KYC information
          logger.info({ chatId, kycId: kycRecord.id }, 'User has completed KYC');
          await ctx.editMessageText(Messages.KYC_COMPLETED(kycRecord), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } else {
          // User has NOT completed KYC - show start KYC button
          logger.info({ chatId }, 'User has not completed KYC');
          await ctx.editMessageText(Messages.KYC_NOT_COMPLETED(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.kycStart(),
          });
        }
      } catch (error) {
        logger.error({ error }, 'Error checking KYC status');
        await ctx.editMessageText(
          `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC của bạn.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Start KYC callback - Begin KYC process with phone number collection
    this.bot.callbackQuery('start_kyc', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const userId = ctx.from.id;

        logger.info({ userId }, 'User started KYC process');

        // Check if user has exceeded KYC attempt limit
        const hasExceeded = await teleUserService.hasExceededKycAttempts(userId);
        if (hasExceeded) {
          logger.warn({ userId }, 'User has exceeded KYC attempt limit');
          await ctx.editMessageText(Messages.KYC_ATTEMPTS_EXCEEDED(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.kycAttemptsExceeded(),
          });
          return;
        }

        // Set user state to wait for phone number
        userStates.set(userId, {
          action: 'kyc',
          waitingFor: 'kyc_phone',
        });

        // Send message with phone request keyboard
        await ctx.editMessageText(Messages.KYC_REQUEST_PHONE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycCancel(),
        });

        // Send a separate message with the contact request keyboard
        await ctx.reply(`📱 Nhấn nút bên dưới để chia sẻ số điện thoại:`, {
          reply_markup: Keyboards.kycPhoneRequest(),
        });
      } catch (error) {
        logger.error({ error }, 'Error starting KYC process');
        await ctx.editMessageText(
          `❌ <b>Lỗi khởi động KYC</b>\n\n` +
          `Không thể bắt đầu quy trình KYC.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Cancel KYC callback
    this.bot.callbackQuery('cancel_kyc', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      logger.info({ userId }, 'User cancelled KYC process');

      // Clear user state
      userStates.delete(userId);

      const firstName = ctx.from?.first_name || 'bạn';
      await ctx.editMessageText(Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    });

    // KYC document type selection - CCCD
    this.bot.callbackQuery('kyc_select_cccd', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || !state.kycPhoneNumber) {
        await ctx.editMessageText(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên KYC đã hết hạn hoặc không hợp lệ.\n\n` +
          `Vui lòng bắt đầu lại quy trình KYC!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
        return;
      }

      logger.info({ userId }, 'User selected CCCD for KYC verification');

      // Store document type and move to ID card collection
      state.kycDocumentType = 'cccd';
      state.waitingFor = 'kyc_id_card';
      userStates.set(userId, state);

      await ctx.editMessageText(Messages.KYC_REQUEST_ID_CARD(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });
    });

    // KYC document type selection - Passport
    this.bot.callbackQuery('kyc_select_passport', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || !state.kycPhoneNumber) {
        await ctx.editMessageText(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên KYC đã hết hạn hoặc không hợp lệ.\n\n` +
          `Vui lòng bắt đầu lại quy trình KYC!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
        return;
      }

      logger.info({ userId }, 'User selected Passport for KYC verification');

      // Store document type and move to passport collection
      state.kycDocumentType = 'passport';
      state.waitingFor = 'kyc_id_card';
      userStates.set(userId, state);

      await ctx.editMessageText(Messages.KYC_REQUEST_PASSPORT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });
    });

    // KYC recapture ID card callback
    this.bot.callbackQuery('kyc_recapture_id_card', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state) {
        return;
      }

      logger.info({ userId }, 'User requested to recapture ID card');

      // Clear ID card data and allow new photo upload
      state.kycIdCardData = undefined;
      state.lastProcessedPhotoId = undefined; // Clear to allow new photo
      state.waitingFor = 'kyc_id_card';
      userStates.set(userId, state);

      // Show appropriate message based on document type
      const message =
        state.kycDocumentType === 'passport'
          ? Messages.KYC_REQUEST_PASSPORT()
          : Messages.KYC_REQUEST_ID_CARD();

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });
    });

    // KYC try different ID card callback (after duplicate error)
    this.bot.callbackQuery('kyc_try_different_id', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state) {
        return;
      }

      logger.info({ userId }, 'User requested to try different ID card after duplicate error');

      // Clear ID card data and allow new photo upload
      state.kycIdCardData = undefined;
      state.lastProcessedPhotoId = undefined; // Clear to allow new photo
      state.waitingFor = 'kyc_id_card';
      userStates.set(userId, state);

      // Show appropriate message based on document type
      const message =
        state.kycDocumentType === 'passport'
          ? Messages.KYC_REQUEST_PASSPORT()
          : Messages.KYC_REQUEST_ID_CARD();

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });
    });

    // Contact support callback
    this.bot.callbackQuery('contact_support', async (ctx) => {
      await ctx.answerCallbackQuery();

      const supportMessage =
        `📞 <b>LIÊN HỆ SUPPORT</b>\n\n` +
        `Vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi:\n\n` +
        `💬 Telegram: @usdt247shopsupport\n\n` +
        `Chúng tôi sẽ hỗ trợ bạn trong thời gian sớm nhất!`;

      await ctx.editMessageText(supportMessage, {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Referral callback - show referral link and count
    this.bot.callbackQuery('referral', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const chatId = ctx.from.id;
        const username = ctx.from.username;

        // Check if user has a username
        if (!username) {
          await ctx.editMessageText(
            `❌ <b>Không thể tạo link giới thiệu</b>\n\n` +
            `Bạn cần có username Telegram để sử dụng tính năng này.\n\n` +
            `Vui lòng thiết lập username trong cài đặt Telegram và thử lại!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Get referral count
        const referralCount = await teleUserService.getReferralCount(chatId);

        // Get bot username
        const botInfo = await this.bot.api.getMe();
        const botUsername = botInfo.username;

        logger.info({ chatId, username, referralCount }, 'User viewed referral information');

        await ctx.editMessageText(Messages.REFERRAL_INFO(username, referralCount, botUsername), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } catch (error) {
        logger.error({ error }, 'Error showing referral information');
        await ctx.editMessageText(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Không thể hiển thị thông tin giới thiệu.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Bank accounts callback - show saved bank accounts
    this.bot.callbackQuery('bank_accounts', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const chatId = ctx.chat?.id;

        if (!chatId) {
          logger.error('Missing chat ID in bank_accounts callback');
          await ctx.editMessageText(
            `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Fetch saved bank accounts
        logger.info({ chatId }, 'Fetching saved bank accounts');
        const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(
          chatId,
          'BANK'
        );

        logger.info(
          { chatId, bankAccountsCount: savedBankAccounts.length },
          'Bank accounts retrieved'
        );

        // Display saved bank accounts
        let message = `🏦 <b>NGÂN HÀNG ĐÃ LƯU</b>\n\n`;

        if (savedBankAccounts.length === 0) {
          message += `❌ Bạn chưa lưu tài khoản ngân hàng nào.\n\n`;
          message += `💡 Nhấn "➕ Thêm mới" để thêm tài khoản ngân hàng.`;

          await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: Keyboards.bankAccountsList([]),
          });
        } else {
          savedBankAccounts.forEach((account, index) => {
            // Look up bank name from bank_id
            const bank = banks.find((b) => b.id === account.bank_id);
            const bankName = bank ? bank.short_name : account.bank_id?.toString() || 'N/A';

            message += `<b>${index + 1}. ${account.full_name || 'N/A'}</b>\n`;
            message += `   🏛️ Ngân hàng: ${bankName}\n`;
            message += `   💳 Số TK: <code>${account.bank_account || 'N/A'}</code>\n\n`;
          });

          await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: Keyboards.bankAccountsList(savedBankAccounts),
          });
        }
      } catch (error) {
        logger.error({ error }, 'Error fetching bank accounts');
        await ctx.editMessageText(
          `❌ <b>Lỗi tải dữ liệu</b>\n\n` +
          `Không thể tải danh sách ngân hàng.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Crypto wallets callback - show saved crypto wallets
    this.bot.callbackQuery('crypto_wallets', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const chatId = ctx.chat?.id;

        if (!chatId) {
          logger.error('Missing chat ID in crypto_wallets callback');
          await ctx.editMessageText(
            `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Fetch saved crypto wallets
        logger.info({ chatId }, 'Fetching saved crypto wallets');
        const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');

        logger.info({ chatId, walletsCount: savedWallets.length }, 'Crypto wallets retrieved');

        // Display saved crypto wallets
        let message = `💎 <b>VÍ CRYPTO ĐÃ LƯU</b>\n\n`;

        if (savedWallets.length === 0) {
          message += `❌ Bạn chưa lưu địa chỉ ví crypto nào.\n\n`;
          message += `💡 Nhấn "➕ Thêm mới" để thêm địa chỉ ví.`;

          await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: Keyboards.cryptoWalletsList([]),
          });
        } else {
          savedWallets.forEach((wallet, index) => {
            message += `<b>${index + 1}. Ví ${index + 1}</b>\n`;
            message += `📮 Địa chỉ: <code>${wallet.wallet_address || 'N/A'}</code>\n\n`;
          });

          await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: Keyboards.cryptoWalletsList(savedWallets),
          });
        }
      } catch (error) {
        logger.error({ error }, 'Error fetching crypto wallets');
        await ctx.editMessageText(
          `❌ <b>Lỗi tải dữ liệu</b>\n\n` +
          `Không thể tải danh sách ví crypto.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Delete bank account prompt - ask for index
    this.bot.callbackQuery('delete_bank_prompt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      logger.info({ userId }, 'User initiated bank account deletion');

      // Fetch saved bank accounts to store in state
      const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

      // Set user state to wait for delete index
      userStates.set(userId, {
        waitingFor: 'delete_bank_index',
        savedBankAccounts: savedBankAccounts,
      });

      await ctx.editMessageText(Messages.ENTER_DELETE_BANK_INDEX(savedBankAccounts), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Delete wallet prompt - ask for index
    this.bot.callbackQuery('delete_wallet_prompt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      logger.info({ userId }, 'User initiated wallet deletion');

      // Fetch saved wallets to store in state
      const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

      // Set user state to wait for delete index
      userStates.set(userId, {
        waitingFor: 'delete_wallet_index',
        savedWallets: savedWallets,
      });

      await ctx.editMessageText(Messages.ENTER_DELETE_WALLET_INDEX(savedWallets), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Confirm delete callback - actually delete the payment info
    this.bot.callbackQuery('confirm_delete', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || !state.paymentInfoId) {
        logger.error({ userId }, 'No payment info ID in state for deletion');
        await ctx.editMessageText(
          `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng thử lại!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
        return;
      }

      try {
        const deleted = await paymentInformationService.deleteById(state.paymentInfoId, userId);

        if (deleted) {
          logger.info({ userId, paymentInfoId: state.paymentInfoId }, 'Payment info deleted');
          await ctx.editMessageText(Messages.DELETE_SUCCESS(), {
            parse_mode: 'HTML',
            reply_markup: await Keyboards.mainMenu(userId),
          });
        } else {
          logger.error(
            { userId, paymentInfoId: state.paymentInfoId },
            'Failed to delete payment info'
          );
          await ctx.editMessageText(Messages.DELETE_FAILED(), {
            parse_mode: 'HTML',
            reply_markup: await Keyboards.mainMenu(userId),
          });
        }

        // Clear the payment info ID from state
        delete state.paymentInfoId;
        userStates.set(userId, state);
      } catch (error) {
        logger.error(
          { userId, paymentInfoId: state.paymentInfoId, error },
          'Error deleting payment info'
        );
        await ctx.editMessageText(Messages.DELETE_FAILED(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      }
    });

    // Cancel delete callback
    this.bot.callbackQuery('cancel_delete', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      // Clear the payment info ID from state
      if (state) {
        delete state.paymentInfoId;
        userStates.set(userId, state);
      }

      // Return to main menu
      await ctx.editMessageText('❌ Đã hủy thao tác xóa.', {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    });

    // Add bank from menu callback - trigger bank addition flow
    this.bot.callbackQuery('add_bank_from_menu', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      logger.info({ userId }, 'User chose to add new bank account from menu');

      // Set user state to wait for bank details
      userStates.set(userId, {
        action: 'sell',
        waitingFor: 'bank_details_single',
        isNewPaymentInfo: true,
      });

      await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Add wallet from menu callback - trigger wallet addition flow
    this.bot.callbackQuery('add_wallet_from_menu', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      logger.info({ userId }, 'User chose to add new wallet from menu');

      // Set user state to wait for wallet address
      userStates.set(userId, {
        action: 'buy',
        waitingFor: 'wallet',
        isNewPaymentInfo: true,
      });

      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Account info callback
    this.bot.callbackQuery('account_info', async (ctx) => {
      await ctx.answerCallbackQuery();

      try {
        const chatId = ctx.chat?.id;

        if (!chatId) {
          logger.error('Missing chat ID in account_info callback');
          await ctx.editMessageText(
            `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Fetch user information from database
        logger.info({ chatId }, 'Fetching user information from database');
        const teleUser = await teleUserService.findByChatId(chatId);

        if (!teleUser) {
          logger.warn({ chatId }, 'User not found in database');
          await ctx.editMessageText(
            `❌ <b>Không tìm thấy thông tin</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn trong hệ thống.\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        logger.info({ chatId, userId: teleUser.id }, 'User information retrieved successfully');

        // Fetch saved payment information
        logger.info({ chatId }, 'Fetching saved payment information');
        const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(
          chatId,
          'BANK'
        );
        const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');

        logger.info(
          {
            chatId,
            bankAccountsCount: savedBankAccounts.length,
            walletsCount: savedWallets.length,
          },
          'Payment information retrieved'
        );

        // Fetch KYC information to get phone number if user is KYC verified
        let phoneNumber: string | null = null;
        if (teleUser.is_kyc) {
          const kycRecord = await kycService.findByChatId(chatId);
          if (kycRecord) {
            phoneNumber = kycRecord.phone;
          }
        }

        // Display user information from database
        await ctx.editMessageText(
          Messages.ACCOUNT_INFO(
            teleUser.chat_id,
            teleUser.first_name || 'N/A',
            teleUser.last_name ?? null,
            teleUser.username || '',
            teleUser.is_kyc ?? false,
            savedBankAccounts,
            savedWallets,
            phoneNumber
          ),
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      } catch (error) {
        logger.error({ error }, 'Error fetching user information');
        await ctx.editMessageText(
          `❌ <b>Lỗi tải thông tin</b>\n\n` +
          `Không thể tải thông tin tài khoản.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Buy USDT callback - show amount selection
    this.bot.callbackQuery('buy_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      try {
        // Check KYC status before allowing buy
        logger.info({ userId }, 'Checking KYC status for buy USDT');
        const user = await teleUserService.findByChatId(userId);

        if (!user) {
          logger.warn({ userId }, 'User not found in database for buy USDT');
          await ctx.editMessageText(
            `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng liên hệ support!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Check if user has completed KYC
        if (!user.is_kyc) {
          logger.info({ userId, isKyc: user.is_kyc }, 'User attempted to buy USDT without KYC');
          await ctx.editMessageText(Messages.KYC_REQUIRED_FOR_TRADING(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.kycRequiredForTrading(),
          });
          return;
        }

        // User is KYC verified, proceed with buy flow
        logger.info(
          { userId, isKyc: user.is_kyc },
          'User is KYC verified, proceeding with buy flow'
        );
        userStates.set(userId, { action: 'buy' });
        await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.buyAmountSelection(),
        });
      } catch (error) {
        logger.error({ error, userId }, 'Error checking KYC status for buy USDT');
        await ctx.editMessageText(
          `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Buy amount preset buttons
    this.bot.callbackQuery(/^buy_amount_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const amount = ctx.callbackQuery.data.replace('buy_amount_', '');

      // Check for saved wallets
      const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

      if (savedWallets.length > 0) {
        // Show saved wallets
        userStates.set(userId, { action: 'buy', amount });
        await ctx.editMessageText(Messages.SELECT_SAVED_WALLET(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.savedWalletSelection(savedWallets),
        });
      } else {
        // No saved wallets, ask for wallet address
        userStates.set(userId, {
          action: 'buy',
          amount,
          waitingFor: 'wallet',
          isNewPaymentInfo: true,
        });
        await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
    });

    // Buy custom amount
    this.bot.callbackQuery('buy_custom', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'buy', waitingFor: 'buy_amount' });
      await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_BUY(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Sell USDT callback - show amount selection
    this.bot.callbackQuery('sell_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      try {
        // Check KYC status before allowing sell
        logger.info({ userId }, 'Checking KYC status for sell USDT');
        const user = await teleUserService.findByChatId(userId);

        if (!user) {
          logger.warn({ userId }, 'User not found in database for sell USDT');
          await ctx.editMessageText(
            `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng liên hệ support!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        // Check if user has completed KYC
        if (!user.is_kyc) {
          logger.info({ userId, isKyc: user.is_kyc }, 'User attempted to sell USDT without KYC');
          await ctx.editMessageText(Messages.KYC_REQUIRED_FOR_TRADING(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.kycRequiredForTrading(),
          });
          return;
        }

        // User is KYC verified, proceed with sell flow
        logger.info(
          { userId, isKyc: user.is_kyc },
          'User is KYC verified, proceeding with sell flow'
        );
        userStates.set(userId, { action: 'sell' });
        await ctx.editMessageText(Messages.SELL_SELECT_AMOUNT(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.sellAmountSelection(),
        });
      } catch (error) {
        logger.error({ error, userId }, 'Error checking KYC status for sell USDT');
        await ctx.editMessageText(
          `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC.\n\n` +
          `Vui lòng thử lại sau!`,
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      }
    });

    // Sell amount preset buttons
    this.bot.callbackQuery(/^sell_amount_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const amount = ctx.callbackQuery.data.replace('sell_amount_', '');

      // Check for saved bank accounts
      const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

      if (savedBankAccounts.length > 0) {
        // Show saved bank accounts
        userStates.set(userId, { action: 'sell', amount });
        await ctx.editMessageText(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
        });
      } else {
        // No saved bank accounts, use simplified single-input format
        const state = userStates.get(userId) || {};
        state.action = 'sell';
        state.amount = amount;
        state.waitingFor = 'bank_details_single';
        state.isNewPaymentInfo = true;
        userStates.set(userId, state);

        logger.info(
          { userId, amount },
          'Sell amount selected, showing single-input bank details prompt'
        );

        await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
    });

    // Sell custom amount
    this.bot.callbackQuery('sell_custom', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'sell', waitingFor: 'sell_amount' });
      await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_SELL(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Bank selection callback
    this.bot.callbackQuery(/^select_bank_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const bankId = parseInt(ctx.callbackQuery.data.replace('select_bank_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Find the selected bank
      const selectedBank = banks.find((b) => b.id === bankId);
      if (!selectedBank) {
        logger.error({ userId, bankId }, 'Bank not found');
        await ctx.reply(
          `❌ <b>Lỗi ngân hàng</b>\n\n` +
          `Không tìm thấy thông tin ngân hàng.\n\n` +
          `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Store bank info in state
      state.bankId = bankId;
      state.bankName = selectedBank.short_name;
      state.waitingFor = 'full_name';
      userStates.set(userId, state);

      logger.info({ userId, bankId, bankName: selectedBank.short_name }, 'Bank selected');

      await ctx.editMessageText(Messages.ENTER_FULL_NAME(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Show more banks callback (pagination)
    this.bot.callbackQuery(/^show_more_banks_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const offset = parseInt(ctx.callbackQuery.data.replace('show_more_banks_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Update offset in state
      state.bankPageOffset = offset;
      userStates.set(userId, state);

      logger.info({ userId, offset }, 'Showing more banks');

      await ctx.editMessageText(Messages.SELECT_BANK(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.bankSelection(offset),
      });
    });

    // Use saved wallet callback
    this.bot.callbackQuery(/^use_saved_wallet_\d+$/, async (ctx) => {
      // Answer callback query immediately to avoid timeout
      try {
        await ctx.answerCallbackQuery();
      } catch (error) {
        // Callback query might already be answered or expired - log and continue
        logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
      }

      const userId = ctx.from.id;
      const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_wallet_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'buy') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Get the saved wallet info
      const paymentInfo = await paymentInformationService.findById(paymentInfoId);
      if (!paymentInfo || !paymentInfo.wallet_address) {
        logger.error({ userId, paymentInfoId }, 'Saved wallet not found');
        await ctx.reply(
          `❌ <b>Lỗi ví</b>\n\n` + `Không tìm thấy thông tin ví đã lưu.\n\n` + `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.walletAddress = paymentInfo.wallet_address;
      state.paymentInfoId = paymentInfoId;
      state.waitingFor = undefined;
      userStates.set(userId, state);

      logger.info(
        { userId, paymentInfoId, wallet: paymentInfo.wallet_address },
        'Using saved wallet'
      );

      // Fetch exchange rates and calculate fees
      let rates;
      try {
        rates = await this.fetchExchangeRates();
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch exchange rates');
        rates = null;
      }

      if (!rates) {
        try {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } catch (error) {
          // If edit fails, try sending a new message
          await ctx.reply(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
        return;
      }

      const usdtAmount = parseFloat(state.amount!);
      const vndAmount = usdtAmount * rates.sell;
      const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
      const gatewayFee = vndAmount * (gatewayFeesPercent / 100);

      await ctx.editMessageText(
        Messages.ORDER_SUMMARY_BUY(
          state.amount!,
          paymentInfo.wallet_address,
          vndAmount,
          rates.sell,
          gatewayFee
        ),
        {
          parse_mode: 'HTML',
          reply_markup: Keyboards.confirmPayment(),
        }
      );
    });

    // Add new wallet callback
    this.bot.callbackQuery('add_new_wallet', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || state.action !== 'buy') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.waitingFor = 'wallet';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info({ userId }, 'User chose to add new wallet');

      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Use saved bank account callback
    this.bot.callbackQuery(/^use_saved_bank_\d+$/, async (ctx) => {
      // Answer callback query immediately to avoid timeout
      try {
        await ctx.answerCallbackQuery();
      } catch (error) {
        // Callback query might already be answered or expired - log and continue
        logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
      }

      const userId = ctx.from.id;
      const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_bank_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Get the saved bank account info
      const paymentInfo = await paymentInformationService.findById(paymentInfoId);
      if (
        !paymentInfo ||
        !paymentInfo.bank_id ||
        !paymentInfo.full_name ||
        !paymentInfo.bank_account
      ) {
        logger.error({ userId, paymentInfoId }, 'Saved bank account not found');
        await ctx.reply(
          `❌ <b>Lỗi ngân hàng</b>\n\n` +
          `Không tìm thấy thông tin ngân hàng đã lưu.\n\n` +
          `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Find bank name
      const bank = banks.find((b) => b.id === paymentInfo.bank_id);
      if (!bank) {
        logger.error({ userId, bankId: paymentInfo.bank_id }, 'Bank not found');
        await ctx.reply(
          `❌ <b>Lỗi ngân hàng</b>\n\n` +
          `Không tìm thấy thông tin ngân hàng.\n\n` +
          `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.bankId = paymentInfo.bank_id;
      state.bankName = bank.short_name;
      state.fullName = paymentInfo.full_name;
      state.accountNumber = paymentInfo.bank_account;
      state.paymentInfoId = paymentInfoId;
      state.waitingFor = undefined;
      userStates.set(userId, state);

      logger.info(
        { userId, paymentInfoId, bankId: paymentInfo.bank_id },
        'Using saved bank account'
      );

      // Fetch exchange rates and calculate fees
      let rates;
      try {
        rates = await this.fetchExchangeRates();
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch exchange rates');
        rates = null;
      }

      if (!rates) {
        try {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } catch (error) {
          // If edit fails, try sending a new message
          await ctx.reply(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
        return;
      }

      const usdtAmount = parseFloat(state.amount!);
      const totalVND = usdtAmount * rates.buy;
      const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
      const serviceFee = totalVND * (gatewayFeesPercent / 100);

      await ctx.editMessageText(
        Messages.SELL_CONFIRMATION(
          state.amount!,
          bank.short_name,
          paymentInfo.full_name,
          paymentInfo.bank_account,
          rates.buy,
          totalVND,
          serviceFee
        ),
        {
          parse_mode: 'HTML',
          reply_markup: Keyboards.confirmPayment(),
        }
      );
    });

    // Add new bank account callback - Single input flow
    this.bot.callbackQuery('add_new_bank', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.waitingFor = 'bank_details_single';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info({ userId }, 'User chose to add new bank account - single input mode');

      await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Confirm payment callback
    this.bot.callbackQuery('confirm_payment', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      logger.info(
        { userId, state: state ? { action: state.action, amount: state.amount } : null },
        'Processing payment confirmation'
      );

      if (!state || !state.action || !state.amount) {
        logger.warn({ userId }, 'Invalid state for payment confirmation');
        await ctx.reply(
          `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên làm việc đã hết hạn.\n\n` +
          `Vui lòng bắt đầu lại!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      try {
        if (state.action === 'buy') {
          logger.info(
            { userId, amount: state.amount, wallet: state.walletAddress },
            'Processing buy order'
          );
          await this.handleBuyConfirmation(ctx, userId, state);
        } else {
          logger.info({ userId, amount: state.amount }, 'Processing sell order');
          await this.handleSellConfirmation(ctx, userId, state);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Capture error to Sentry (already captured in handleBuyConfirmation/handleSellConfirmation,
        // but capture here too in case error occurs before those methods)
        captureErrorWithContext(error, {
          userId,
          action: 'processPaymentConfirmation',
          state: state.action,
        });

        if (errorMessage === 'KYC verification required') {
          await ctx.reply(Messages.KYC_REQUIRED(), { parse_mode: 'HTML' });
        } else if (errorMessage.includes('User not found')) {
          await ctx.reply(
            `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n` +
            `Vui lòng liên hệ support để được hỗ trợ!`,
            { parse_mode: 'HTML' }
          );
        } else if (errorMessage.includes('API error')) {
          await ctx.reply(
            `❌ <b>Lỗi kết nối</b>\n\n` +
            `Không thể kết nối đến hệ thống thanh toán.\n` +
            `Vui lòng thử lại sau ít phút!`,
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(
            `❌ <b>Có lỗi xảy ra</b>\n\n` +
            `Chi tiết: ${errorMessage}\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
            { parse_mode: 'HTML' }
          );
        }
      }
    });

    // Cancel payment callback
    this.bot.callbackQuery('cancel_payment', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.delete(userId);
      await ctx.editMessageText(Messages.PAYMENT_CANCELLED(), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    });

    // Cancel order callback - handles order cancellation via API
    this.bot.callbackQuery(/^cancel_order_(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const orderId = ctx.match[1];

      if (!orderId) {
        logger.error({ userId }, 'Order ID not found in callback data');
        await ctx.reply(
          `❌ <b>Lỗi đơn hàng</b>\n\n` + `Không tìm thấy mã đơn hàng.\n\n` + `Vui lòng thử lại!`,
          {
            parse_mode: 'HTML',
            reply_markup: await Keyboards.mainMenu(userId),
          }
        );
        return;
      }

      logger.info({ userId, orderId }, 'User requested to cancel order');

      try {
        // Call USDT247 API to close the order
        const partnerAppKey = process.env.PARTNER_APP_KEY;
        if (!partnerAppKey) {
          logger.error('PARTNER_APP_KEY not configured');
          await ctx.reply(
            `❌ <b>Lỗi cấu hình</b>\n\n` +
            `Hệ thống chưa được cấu hình đúng.\n\n` +
            `Vui lòng liên hệ support!`,
            {
              parse_mode: 'HTML',
              reply_markup: await Keyboards.mainMenu(userId),
            }
          );
          return;
        }

        const response = await fetch(`https://api.usdt247.shop/partners/orders/${orderId}/close`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Partner-App-Key': partnerAppKey,
          },
        });

        logger.info(
          { userId, orderId, status: response.status, ok: response.ok },
          'Cancel order API response received'
        );

        if (response.ok) {
          // Track this as a user-initiated cancellation to prevent duplicate webhook notification
          userCancelledOrders.add(orderId);
          logger.info(
            { userId, orderId },
            'Marked order as user-cancelled to suppress webhook notification'
          );

          // Auto-remove from set after 60 seconds (in case webhook arrives late)
          setTimeout(() => {
            userCancelledOrders.delete(orderId);
            logger.debug({ orderId }, 'Removed order from user-cancelled tracking set');
          }, 60000);

          // Order cancelled successfully - send user-friendly message
          await ctx.reply(Messages.ORDER_CANCELLED(), {
            parse_mode: 'HTML',
            reply_markup: await Keyboards.mainMenu(userId),
          });
        } else {
          // Failed to cancel order
          const errorText = await response.text();
          logger.error(
            { userId, orderId, status: response.status, errorText },
            'Failed to cancel order'
          );

          await ctx.reply(Messages.ORDER_CANCEL_FAILED(), {
            parse_mode: 'HTML',
            reply_markup: await Keyboards.mainMenu(userId),
          });
        }
      } catch (error) {
        logger.error(
          {
            userId,
            orderId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error cancelling order'
        );

        await ctx.reply(Messages.ORDER_CANCEL_FAILED(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      }
    });

    // Back to menu callback
    this.bot.callbackQuery('back_to_menu', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.delete(userId);
      const firstName = ctx.from?.first_name || 'bạn';
      await ctx.editMessageText(Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    });

    // Contact handler - for phone number sharing
    this.bot.on('message:contact', async (ctx) => {
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || state.waitingFor !== 'kyc_phone') {
        return;
      }

      try {
        const contact = ctx.message.contact;
        const phoneNumber = contact.phone_number;

        logger.info({ userId, phoneNumber }, 'Received phone number via contact sharing');

        // Validate phone number
        if (this.validateVietnamesePhoneNumber(phoneNumber)) {
          // Store phone number in state
          state.kycPhoneNumber = phoneNumber;
          state.waitingFor = undefined; // Clear waiting state
          userStates.set(userId, state);

          await ctx.reply(Messages.KYC_PHONE_RECEIVED(phoneNumber), {
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true },
          });

          // Request document type selection
          await ctx.reply(Messages.KYC_SELECT_DOCUMENT_TYPE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.kycDocumentTypeSelection(),
          });

          logger.info(
            { userId, phoneNumber },
            'Phone number validated, requesting document type selection'
          );
        } else {
          await ctx.reply(Messages.KYC_INVALID_PHONE(), {
            parse_mode: 'HTML',
          });
        }
      } catch (error) {
        logger.error({ error, userId }, 'Error handling contact message');
        await ctx.reply(
          `❌ <b>Lỗi xử lý số điện thoại</b>\n\n` +
          `Không thể xử lý số điện thoại của bạn.\n\n` +
          `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
      }
    });

    // Photo handler - for ID card images
    this.bot.on('message:photo', async (ctx) => {
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      // Only process if waiting for ID card
      if (!state || state.waitingFor !== 'kyc_id_card') {
        return;
      }

      // Get the largest photo (best quality) to check file_unique_id
      const photos = ctx.message.photo;
      if (!photos || photos.length === 0) {
        logger.error({ userId }, 'No photos found in message');
        return;
      }

      const photo = photos[photos.length - 1];
      if (!photo) {
        logger.error({ userId }, 'Failed to get photo from array');
        return;
      }

      const photoUniqueId = photo.file_unique_id;

      // Deduplication: Check if we've already processed this exact photo
      if (state.lastProcessedPhotoId === photoUniqueId) {
        logger.info(
          { userId, photoUniqueId },
          'Ignoring duplicate photo - already processed this image'
        );
        return;
      }

      // Prevent concurrent processing by immediately changing state
      state.waitingFor = 'kyc_processing';
      state.lastProcessedPhotoId = photoUniqueId;
      userStates.set(userId, state);

      logger.info({ userId, photoUniqueId }, 'Starting ID card photo processing');

      try {
        await this.handleKycIdCardPhoto(ctx, userId, state);
      } catch (error) {
        logger.error({ error, userId }, 'Error handling ID card photo');

        // Reset state to allow retry
        state.waitingFor = 'kyc_id_card';
        state.lastProcessedPhotoId = undefined;
        userStates.set(userId, state);

        // Don't show error message here - handleKycIdCardPhoto already showed a specific error message
        // Showing another generic error would be redundant and confusing
      }
    });

    // Text message handler
    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state) {
        return;
      }

      const text = ctx.message.text.trim();

      // Manual phone input is disabled - users must use Telegram's contact sharing feature
      // Keeping this code for potential future reactivation
      // if (state.waitingFor === 'kyc_phone') {
      //   await this.handleKycPhoneInput(ctx, userId, state, text);
      // } else
      if (state.waitingFor === 'buy_amount') {
        await this.handleBuyAmountInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'sell_amount') {
        await this.handleSellAmountInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'wallet') {
        await this.handleWalletInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'full_name') {
        await this.handleFullNameInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'account_number') {
        await this.handleAccountNumberInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'bank_details_single') {
        await this.handleBankDetailsSingleInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'delete_bank_index') {
        await this.handleDeleteBankIndexInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'delete_wallet_index') {
        await this.handleDeleteWalletIndexInput(ctx, userId, state, text);
      }
    });

    // Error handler with better error classification
    this.bot.catch((err) => {
      const error = err.error as any;

      // Handle expected errors gracefully
      if (error?.error_code === 403) {
        // User blocked the bot - this is normal, log at info level
        logger.info(
          {
            errorCode: error.error_code,
            description: error.description,
            userId: err.ctx?.from?.id,
          },
          'User blocked the bot'
        );
        return;
      }

      if (error?.error_code === 400 && error?.description?.includes('query is too old')) {
        // Callback query timeout - user took too long or clicked multiple times
        logger.warn(
          {
            errorCode: error.error_code,
            description: error.description,
            userId: err.ctx?.from?.id,
          },
          'Callback query timeout or duplicate click'
        );
        return;
      }

      // Log unexpected errors at error level
      logger.error(
        {
          error: err,
          errorCode: error?.error_code,
          description: error?.description,
          userId: err.ctx?.from?.id,
        },
        'Unexpected bot error'
      );
    });
  }

  /**
   * Fetch exchange rates from Supabase API
   */
  private async fetchExchangeRates(): Promise<ExchangeRate | null> {
    try {
      const response = await fetch(
        process.env.EXCHANGE_RATES_URL || 'https://iakzvzwriyxyshfggbwu.supabase.co/functions/v1/get_exchange_rates'
      );
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data as ExchangeRate;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      return null;
    }
  }

  /**
   * Validate Vietnamese phone number
   * Accepts formats: 0xxxxxxxxx (10 digits) or +84xxxxxxxxx
   */
  private validateVietnamesePhoneNumber(phoneNumber: string): boolean {
    // Remove all spaces and dashes
    const cleaned = phoneNumber.replace(/[\s-]/g, '');

    // Pattern 1: 0xxxxxxxxx (10 digits starting with 0)
    const pattern1 = /^0\d{9}$/;

    // Pattern 2: +84xxxxxxxxx (starts with +84, followed by 9-10 digits)
    const pattern2 = /^\+84\d{9,10}$/;

    // Pattern 3: 84xxxxxxxxx (starts with 84, followed by 9-10 digits)
    const pattern3 = /^84\d{9,10}$/;

    return pattern1.test(cleaned) || pattern2.test(cleaned) || pattern3.test(cleaned);
  }

  /**
   * Parse sex/gender field from FPT AI Vision API response
   * API returns different formats for different document types:
   * - CCCD: "NAM" or "NỮ" (Vietnamese only)
   * - Passport: "NAM/M" or "NỮ/F" (Vietnamese/English format)
   * Returns the English abbreviation for database storage (e.g., "M" or "F")
   */
  private parseSexForDatabase(sex: string | undefined): string {
    if (!sex) return 'N/A';

    // Check if format contains slash (Passport format: "NAM/M" or "NỮ/F")
    if (sex.includes('/')) {
      const parts = sex.split('/');
      if (parts.length > 1) {
        return parts[1] || sex; // Return English abbreviation after slash
      }
    }

    // Handle CCCD format (Vietnamese only: "NAM" or "NỮ")
    // Convert Vietnamese text to English abbreviation
    const sexUpper = sex.toUpperCase().trim();
    if (sexUpper === 'NAM') {
      return 'M';
    } else if (sexUpper === 'NỮ' || sexUpper === 'NU') {
      return 'F';
    }

    // Fallback: return as-is if format is unrecognized
    return sex;
  }

  /**
   * Handle buy amount input (custom amount)
   */
  private async handleBuyAmountInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const amount = parseFloat(text.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
      return;
    }

    state.amount = text.replace(/,/g, '');

    // Check for saved wallets
    const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

    if (savedWallets.length > 0) {
      // Show saved wallets
      userStates.set(userId, state);
      await ctx.reply(Messages.SELECT_SAVED_WALLET(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedWalletSelection(savedWallets),
      });
    } else {
      // No saved wallets, ask for wallet address
      state.waitingFor = 'wallet';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);
      await ctx.reply(Messages.ENTER_WALLET_ADDRESS(), { parse_mode: 'HTML' });
    }
  }

  /**
   * Handle sell amount input (custom amount)
   */
  private async handleSellAmountInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const amount = parseFloat(text.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
      return;
    }

    state.amount = text.replace(/,/g, '');

    // Check for saved bank accounts
    const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

    if (savedBankAccounts.length > 0) {
      // Show saved bank accounts
      userStates.set(userId, state);
      await ctx.reply(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
      });
    } else {
      // No saved bank accounts, use simplified single-input format
      state.waitingFor = 'bank_details_single';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info(
        { userId, amount: state.amount },
        'Custom sell amount entered, showing single-input bank details prompt'
      );

      await ctx.reply(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
  }

  /**
   * Handle wallet address input
   */
  private async handleWalletInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Basic wallet validation (0x followed by 40 hex characters)
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      await ctx.reply(Messages.INVALID_WALLET(), { parse_mode: 'HTML' });
      return;
    }

    state.walletAddress = text;
    state.waitingFor = undefined;

    // Save wallet address if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if wallet already exists
        const exists = await paymentInformationService.walletExists(userId, text);
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'CRYPTO',
            wallet_address: text,
          });
          logger.info({ userId, wallet: text }, 'Saved new wallet address');
        } else {
          logger.info({ userId, wallet: text }, 'Wallet address already exists, skipping save');
        }
      } catch (error) {
        logger.error({ userId, wallet: text, error }, 'Error saving wallet address');
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    // Check if this is being added from the menu (no amount in state)
    if (!state.amount) {
      // Clear user state
      userStates.delete(userId);

      // Show success message and return to crypto wallets list
      await ctx.reply(
        `✅ <b>ĐÃ LƯU ĐỊA CHỈ VÍ</b>\n\n` +
        `Địa chỉ ví đã được lưu thành công!\n\n` +
        `📮 Địa chỉ: <code>${text}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        }
      );
      return;
    }

    userStates.set(userId, state);

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const usdtAmount = parseFloat(state.amount!);
    const vndAmount = usdtAmount * rates.sell;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const gatewayFee = vndAmount * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.ORDER_SUMMARY_BUY(state.amount!, text, vndAmount, rates.sell, gatewayFee),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
  }

  /**
   * Handle full name input for sell flow
   */
  private async handleFullNameInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Validate full name (non-empty, at least 2 characters)
    if (!text || text.length < 2) {
      await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
      return;
    }

    state.fullName = text;
    state.waitingFor = 'account_number';
    userStates.set(userId, state);

    logger.info({ userId, fullName: text }, 'Full name entered');

    await ctx.reply(Messages.ENTER_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
  }

  /**
   * Handle account number input for sell flow
   */
  private async handleAccountNumberInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Validate account number (numeric only)
    if (!/^\d+$/.test(text)) {
      await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
      return;
    }

    state.accountNumber = text;
    state.waitingFor = undefined;

    logger.info({ userId, accountNumber: text }, 'Account number entered');

    // Show confirmation screen with all collected details
    if (!state.amount || !state.bankName || !state.fullName || !state.bankId) {
      logger.error({ userId, state }, 'Missing required fields for sell confirmation');
      await ctx.reply(
        `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin cần thiết để xác nhận giao dịch.\n\n` +
        `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Save bank account if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if bank account already exists
        const exists = await paymentInformationService.bankAccountExists(
          userId,
          state.bankId,
          text
        );
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'BANK',
            bank_id: state.bankId,
            full_name: state.fullName,
            bank_account: text,
          });
          logger.info(
            { userId, bankId: state.bankId, accountNumber: text },
            'Saved new bank account'
          );
        } else {
          logger.info(
            { userId, bankId: state.bankId, accountNumber: text },
            'Bank account already exists, skipping save'
          );
        }
      } catch (error) {
        logger.error(
          { userId, bankId: state.bankId, accountNumber: text, error },
          'Error saving bank account'
        );
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    userStates.set(userId, state);

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const usdtAmount = parseFloat(state.amount);
    const totalVND = usdtAmount * rates.buy;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const serviceFee = totalVND * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.SELL_CONFIRMATION(
        state.amount,
        state.bankName,
        state.fullName,
        text,
        rates.buy,
        totalVND,
        serviceFee
      ),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
  }

  /**
   * Handle bank details single input (format: BANK_NAME, FULL_NAME, ACCOUNT_NUMBER)
   */
  private async handleBankDetailsSingleInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Split by comma and trim whitespace
    const parts = text.split(',').map((part) => part.trim());

    // Validate format: must have exactly 3 parts
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      await ctx.reply(Messages.INVALID_BANK_DETAILS_FORMAT(), { parse_mode: 'HTML' });
      return;
    }

    const bankNameInput = parts[0];
    const fullNameInput = parts[1];
    const accountNumberInput = parts[2];

    // Validate bank name: must not contain numbers
    if (/\d/.test(bankNameInput)) {
      await ctx.reply(Messages.INVALID_BANK_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
      return;
    }

    // Validate full name: must not contain numbers and minimum 2 characters
    if (/\d/.test(fullNameInput)) {
      await ctx.reply(Messages.INVALID_FULL_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
      return;
    }

    if (fullNameInput.length < 2) {
      await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
      return;
    }

    // Validate account number: must be numeric only
    if (!/^\d+$/.test(accountNumberInput)) {
      await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
      return;
    }

    // Convert to uppercase
    const bankNameUpper = bankNameInput.toUpperCase();
    const fullNameUpper = fullNameInput.toUpperCase();

    // Find bank by name (case-insensitive matching)
    const bank = banks.find(
      (b) =>
        b.short_name.toUpperCase() === bankNameUpper ||
        b.bank_name.toUpperCase().includes(bankNameUpper) ||
        b.cvpay_code.toUpperCase() === bankNameUpper
    );

    if (!bank) {
      logger.warn({ userId, bankNameInput: bankNameUpper }, 'Bank not found');
      await ctx.reply(Messages.BANK_NOT_FOUND(), { parse_mode: 'HTML' });
      return;
    }

    // Set state with parsed values
    state.bankId = bank.id;
    state.bankName = bank.short_name;
    state.fullName = fullNameUpper;
    state.accountNumber = accountNumberInput;
    state.waitingFor = undefined;

    logger.info(
      { userId, bankId: bank.id, bankName: bank.short_name, fullName: fullNameUpper },
      'Bank details parsed successfully from single input'
    );

    // Save bank account if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if bank account already exists
        const exists = await paymentInformationService.bankAccountExists(
          userId,
          bank.id,
          accountNumberInput
        );
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'BANK',
            bank_id: bank.id,
            full_name: fullNameUpper,
            bank_account: accountNumberInput,
          });
          logger.info(
            { userId, bankId: bank.id, accountNumber: accountNumberInput },
            'Saved new bank account from single input'
          );
        } else {
          logger.info(
            { userId, bankId: bank.id, accountNumber: accountNumberInput },
            'Bank account already exists, skipping save'
          );
        }
      } catch (error) {
        logger.error(
          { userId, bankId: bank.id, accountNumber: accountNumberInput, error },
          'Error saving bank account from single input'
        );
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    // Check if this is being added from the menu (no amount in state)
    if (!state.amount) {
      // Clear user state
      userStates.delete(userId);

      // Show success message and return to bank accounts list
      await ctx.reply(
        `✅ <b>ĐÃ LƯU TÀI KHOẢN NGÂN HÀNG</b>\n\n` +
        `Tài khoản ngân hàng đã được lưu thành công!\n\n` +
        `🏛️ Ngân hàng: <b>${bank.short_name}</b>\n` +
        `👤 Chủ TK: <b>${fullNameUpper}</b>\n` +
        `💳 Số TK: <code>${accountNumberInput}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        }
      );
      return;
    }

    userStates.set(userId, state);

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const usdtAmount = parseFloat(state.amount);
    const totalVND = usdtAmount * rates.buy;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const serviceFee = totalVND * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.SELL_CONFIRMATION(
        state.amount,
        bank.short_name,
        fullNameUpper,
        accountNumberInput,
        rates.buy,
        totalVND,
        serviceFee
      ),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
  }

  /**
   * Check if a message type has been sent for an order
   */
  private hasMessageBeenSent(orderId: string, messageType: string): boolean {
    const orderMessages = sentMessages.get(orderId);
    return orderMessages ? orderMessages.has(messageType) : false;
  }

  /**
   * Mark a message type as sent for an order
   */
  private markMessageAsSent(orderId: string, messageType: string): void {
    let orderMessages = sentMessages.get(orderId);
    if (!orderMessages) {
      orderMessages = new Set<string>();
      sentMessages.set(orderId, orderMessages);
    }
    orderMessages.add(messageType);

    logger.debug({ orderId, messageType }, 'Marked message as sent');
  }

  /**
   * Clean up tracking data for an order after a delay
   */
  private scheduleOrderTrackingCleanup(orderId: string, delayMs: number = 300000): void {
    setTimeout(() => {
      sentMessages.delete(orderId);
      newlyCreatedOrders.delete(orderId);
      userCancelledOrders.delete(orderId);
      logger.debug({ orderId }, 'Cleaned up order tracking data');
    }, delayMs);
  }

  /**
   * Handle buy confirmation - create deposit order and show QR code
   */
  private async handleBuyConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    // Check if user is already processing an order
    if (processingUsers.has(userId)) {
      logger.warn({ userId }, 'User is already processing an order, ignoring duplicate request');
      await ctx.answerCallbackQuery('⏳ Đơn hàng đang được xử lý, vui lòng đợi...');
      return;
    }

    if (!state.amount || !state.walletAddress) {
      logger.error({ userId, state }, 'Missing amount or wallet address in buy confirmation');
      await ctx.reply(
        `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin số lượng hoặc địa chỉ ví.\n\n` +
        `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Mark user as processing
    processingUsers.add(userId);
    logger.info({ userId }, 'User marked as processing order');

    try {
      // Fetch exchange rates to calculate VND amount from USDT amount
      const rates = await this.fetchExchangeRates();
      if (!rates) {
        await ctx.reply(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
        return;
      }

      // Calculate VND amount from USDT amount
      const usdtAmount = parseFloat(state.amount);
      const vndAmount = Math.round(usdtAmount * rates.sell);

      // Calculate gateway fee (service fee)
      const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
      const gatewayFee = Math.round(vndAmount * (gatewayFeesPercent / 100));

      // Calculate total amount including service fee
      const totalAmount = vndAmount + gatewayFee;

      logger.info(
        {
          userId,
          usdtAmount: state.amount,
          vndAmount: vndAmount.toString(),
          gatewayFee: gatewayFee.toString(),
          totalAmount: totalAmount.toString(),
          buyRate: rates.sell,
          wallet: state.walletAddress,
          chainId: telegramConfig.chainId,
          tokenAddress: telegramConfig.tokenAddress,
        },
        'Calling deposit API with total VND amount'
      );

      // Call deposit API with total VND amount (integer, no decimals)
      const order = await paymentService.processDeposit({
        chat_id: userId,
        amount: totalAmount.toString(), // VND amount as integer string (e.g., "279390")
        chain_id: telegramConfig.chainId,
        token_address: telegramConfig.tokenAddress,
        recipient: state.walletAddress,
        callback: telegramConfig.callbackUrl,
      });

      // Extract bank information from order response
      const bankInfo = order.body?.bankInfo;

      logger.info(
        {
          orderId: order.id,
          hasPayData: !!order.pay_data,
          hasQrCode: !!order.pay_data?.qr_code,
          hasBankInfo: !!bankInfo,
          bankName: bankInfo?.bankName,
          accountNumber: bankInfo?.bankAccountNumber,
        },
        'Deposit order created successfully'
      );

      // CRITICAL: Track this order IMMEDIATELY to prevent webhook race condition
      // The webhook can arrive very quickly after order creation, so we must add
      // the order to the tracking set BEFORE sending any messages
      newlyCreatedOrders.add(order.id);
      logger.info(
        { orderId: order.id },
        'Order added to tracking set to prevent duplicate webhook notifications'
      );

      // Auto-remove from set after 30 seconds (allows for delayed webhooks)
      // Increased from 10s to 30s to handle cases where webhooks arrive after 10+ seconds
      setTimeout(() => {
        newlyCreatedOrders.delete(order.id);
        logger.debug({ orderId: order.id }, 'Removed order from newly created tracking set');
      }, 30000);

      // Clear user state
      userStates.delete(userId);

      // Generate and send QR code from pay_data.qr_code
      if (order.pay_data?.qr_code) {
        logger.info({ orderId: order.id }, 'Starting QR code flow - sending bank info first');

        // Step 1: Send bank information message with VND amount (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'bank_info')) {
          await ctx.reply(
            Messages.PAYMENT_QR_MESSAGE(
              bankInfo?.bankName,
              bankInfo?.bankAccountNumber,
              bankInfo?.bankAccountName,
              totalAmount
            ),
            { parse_mode: 'HTML' }
          );
          this.markMessageAsSent(order.id, 'bank_info');
          logger.info({ orderId: order.id }, 'Bank information message sent');
        } else {
          logger.info({ orderId: order.id }, 'Bank information message already sent, skipping');
        }

        // Step 2: Generate and send QR code (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'qr_code')) {
          logger.info({ orderId: order.id }, 'Generating QR code image');
          const qrCodeImage = await this.generateQRCode(order.pay_data.qr_code);
          logger.info(
            { orderId: order.id, qrCodeSize: qrCodeImage.length },
            'QR code generated successfully'
          );

          // Step 3: Send QR code image with cancel button
          await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
            caption: Messages.PAYMENT_QR_CAPTION(),
            parse_mode: 'HTML',
            reply_markup: Keyboards.qrCodeWithCancel(order.id),
          });
          this.markMessageAsSent(order.id, 'qr_code');
          logger.info({ orderId: order.id }, 'QR code image sent successfully');
        } else {
          logger.info({ orderId: order.id }, 'QR code already sent, skipping');
        }

        // Step 4: Send processing status notification (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'processing_status')) {
          await ctx.reply(Messages.ORDER_STATE_PROCESSING(order.id), {
            parse_mode: 'HTML',
          });
          this.markMessageAsSent(order.id, 'processing_status');
          logger.info(
            { orderId: order.id },
            'Processing status notification sent - order flow complete'
          );
        } else {
          logger.info({ orderId: order.id }, 'Processing status already sent, skipping');
        }

        // Schedule cleanup of tracking data after 5 minutes
        this.scheduleOrderTrackingCleanup(order.id);
      } else {
        logger.error(
          { orderId: order.id, payData: order.pay_data },
          'No QR code in order response'
        );
        await ctx.reply(
          `❌ <b>Lỗi tạo đơn hàng</b>\n\n` +
          `Không thể tạo mã QR thanh toán.\n\n` +
          `Vui lòng thử lại hoặc liên hệ support!`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      captureErrorWithContext(error, {
        userId,
        action: 'handleBuyConfirmation',
        amount: state.amount,
        walletAddress: state.walletAddress,
      });
      throw error;
    } finally {
      // Always remove user from processing set
      processingUsers.delete(userId);
      logger.info({ userId }, 'User removed from processing set');
    }
  }

  /**
   * Handle sell confirmation - create withdrawal order and show recipient address
   */
  private async handleSellConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    // Check if user is already processing an order
    if (processingUsers.has(userId)) {
      logger.warn({ userId }, 'User is already processing an order, ignoring duplicate request');
      await ctx.answerCallbackQuery('⏳ Đơn hàng đang được xử lý, vui lòng đợi...');
      return;
    }

    // Validate all required fields
    if (!state.amount || !state.bankId || !state.fullName || !state.accountNumber) {
      logger.error({ userId, state }, 'Missing required fields for sell confirmation');
      await ctx.reply(
        `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin cần thiết để xác nhận giao dịch.\n\n` +
        `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Mark user as processing
    processingUsers.add(userId);
    logger.info({ userId }, 'User marked as processing order');

    try {
      logger.info(
        {
          userId,
          amount: state.amount,
          bankId: state.bankId,
          bankName: state.bankName,
          fullName: state.fullName,
          accountNumber: state.accountNumber,
        },
        'Processing sell order with complete payment info'
      );

      // Call withdrawal API with collected payment_info
      logger.info({ userId }, 'Calling withdrawal API');

      const order = await paymentService.processWithdrawal({
        chat_id: userId,
        amount: state.amount,
        chain_id: telegramConfig.chainId,
        token_address: telegramConfig.tokenAddress,
        callback: telegramConfig.callbackUrl,
        payment_info: {
          bank_id: state.bankId,
          full_name: state.fullName,
          account_type: 1, // Always 1 as per requirements
          account_number: state.accountNumber,
        },
      });

      logger.info(
        {
          userId,
          orderId: order.id,
          hasPayData: !!order.pay_data,
          hasAddress: !!order.pay_data?.address,
          payData: order.pay_data,
          recipient: order.recipient,
          body: order.body,
        },
        'Withdrawal order created successfully - checking for recipient address'
      );

      // CRITICAL: Track this order IMMEDIATELY to prevent webhook race condition
      // The webhook can arrive very quickly after order creation, so we must add
      // the order to the tracking set BEFORE sending any messages
      newlyCreatedOrders.add(order.id);
      logger.info(
        { orderId: order.id },
        'Order added to tracking set to prevent duplicate webhook notifications'
      );

      // Auto-remove from set after 30 seconds (allows for delayed webhooks)
      // Increased from 10s to 30s to handle cases where webhooks arrive after 10+ seconds
      setTimeout(() => {
        newlyCreatedOrders.delete(order.id);
        logger.debug({ orderId: order.id }, 'Removed order from newly created tracking set');
      }, 30000);

      // Extract recipient address - try multiple possible locations
      let recipientAddress: string | undefined;

      // Priority 1: Check pay_data.address
      if (order.pay_data?.address) {
        recipientAddress = order.pay_data.address;
        logger.info(
          { userId, orderId: order.id, source: 'pay_data.address' },
          'Found recipient address'
        );
      }
      // Priority 2: Check recipient field (top-level)
      else if (order.recipient) {
        recipientAddress = order.recipient;
        logger.info({ userId, orderId: order.id, source: 'recipient' }, 'Found recipient address');
      }

      // Clear user state
      userStates.delete(userId);

      // Show recipient address where user should send USDT
      if (recipientAddress) {
        logger.info(
          { userId, orderId: order.id, recipientAddress },
          'Sending recipient address to user'
        );

        // Send wallet address message with USDT amount (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'wallet_address')) {
          await ctx.reply(Messages.PAYMENT_SELL_ADDRESS(recipientAddress, state.amount), {
            parse_mode: 'HTML',
          });

          // Send wallet address only (for easy copying)
          await ctx.reply(`<code>${recipientAddress}</code>`, {
            parse_mode: 'HTML',
          });
          this.markMessageAsSent(order.id, 'wallet_address');
          logger.info({ orderId: order.id }, 'Wallet address messages sent');
        } else {
          logger.info({ orderId: order.id }, 'Wallet address messages already sent, skipping');
        }

        // Generate and send QR code for the wallet address (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'qr_code')) {
          logger.info(
            { orderId: order.id, recipientAddress },
            'Generating QR code for wallet address'
          );

          const qrCodeImage = await this.generateQRCode(recipientAddress);
          logger.info(
            { orderId: order.id, qrCodeSize: qrCodeImage.length },
            'QR code generated, sending to user'
          );

          await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
            caption:
              `📱 <b>Quét mã QR để sao chép địa chỉ ví</b>\n\n` +
              `⏰ Sau khi chuyển USDT, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 3-30 giây.\n\n` +
              `📞 Liên hệ support nếu có vấn đề!`,
            parse_mode: 'HTML',
            reply_markup: Keyboards.qrCodeWithCancel(order.id),
          });
          this.markMessageAsSent(order.id, 'qr_code');
          logger.info({ userId, orderId: order.id }, 'QR code sent successfully');
        } else {
          logger.info({ orderId: order.id }, 'QR code already sent, skipping');
        }

        // Send processing status notification (only if not sent before)
        if (!this.hasMessageBeenSent(order.id, 'processing_status')) {
          await ctx.reply(Messages.ORDER_STATE_PROCESSING(order.id), {
            parse_mode: 'HTML',
          });
          this.markMessageAsSent(order.id, 'processing_status');
          logger.info(
            { userId, orderId: order.id },
            'Processing status notification sent - sell flow complete'
          );
        } else {
          logger.info({ orderId: order.id }, 'Processing status already sent, skipping');
        }

        // Schedule cleanup of tracking data after 5 minutes
        this.scheduleOrderTrackingCleanup(order.id);
      } else {
        logger.error(
          {
            userId,
            orderId: order.id,
            fullOrder: {
              pay_data: order.pay_data,
              recipient: order.recipient,
              body: order.body,
              payment_info: order.payment_info,
            },
          },
          'No recipient address found in any expected field'
        );
        await ctx.reply(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Không tìm thấy địa chỉ ví nhận USDT trong phản hồi từ hệ thống.\n\n` +
          `Mã đơn: <code>${order.id}</code>\n\n` +
          `Vui lòng liên hệ support với mã đơn hàng trên để được hỗ trợ!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
      }
    } catch (error) {
      captureErrorWithContext(error, {
        userId,
        action: 'handleSellConfirmation',
        amount: state.amount,
        bankId: state.bankId,
        accountNumber: state.accountNumber,
      });
      throw error;
    } finally {
      // Always remove user from processing set
      processingUsers.delete(userId);
      logger.info({ userId }, 'User removed from processing set');
    }
  }

  /**
   * Generate QR code from VietQR string
   */
  private async generateQRCode(qrString: string): Promise<Buffer> {
    const qrApiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrString)}&size=300&margin=2`;

    const response = await fetch(qrApiUrl);

    if (!response.ok) {
      throw new Error(`QR API returned status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Send notification to user
   */
  async sendNotification(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
    }
  }

  /**
   * Send order status update notification with enhanced messages
   * NOTE: Only sends notifications for main order state changes, ignores processing_state
   */
  async sendOrderStatusUpdate(
    chatId: number,
    orderId: string,
    state: number,
    processingState?: number
  ): Promise<void> {
    // Check if this is a user-initiated cancellation (state 5 = Cancelled)
    if (state === 5 && userCancelledOrders.has(orderId)) {
      logger.info(
        { chatId, orderId, state },
        'Skipping webhook notification for user-cancelled order (user already notified)'
      );
      // Remove from tracking set since we've handled it
      userCancelledOrders.delete(orderId);
      return;
    }

    // Check if this is initial PROCESSING state for a newly created order
    // (we send the processing notification manually after QR code)
    if (state === 2 && newlyCreatedOrders.has(orderId)) {
      logger.info(
        { chatId, orderId, state },
        'Skipping initial PROCESSING webhook notification (will be sent after QR code)'
      );
      // Remove from tracking set since we've handled it
      newlyCreatedOrders.delete(orderId);
      return;
    }

    // Only use the main order state for notifications
    // Ignore processing_state parameter completely
    const message = this.getOrderStateMessage(orderId, state);

    logger.info(
      {
        chatId,
        orderId,
        state,
        processingState: processingState ?? 'N/A',
      },
      'Sending order state notification (processing_state ignored)'
    );

    await this.sendNotification(chatId, message);
  }

  /**
   * Get order state message based on state number
   */
  private getOrderStateMessage(orderId: string, state: number): string {
    switch (state) {
      case 1:
        return Messages.ORDER_STATE_CREATED(orderId);
      case 2:
        return Messages.ORDER_STATE_PROCESSING(orderId);
      case 3:
        return Messages.ORDER_STATE_COMPLETED(orderId);
      case 4:
        return Messages.ORDER_STATE_FAILED(orderId);
      case 5:
        return Messages.ORDER_STATE_CANCELLED(orderId);
      default:
        return Messages.ORDER_STATUS_UPDATE(orderId, `State ${state}`);
    }
  }

  /**
   * Handle delete bank index input
   */
  private async handleDeleteBankIndexInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const index = parseInt(text);

    // Validate index
    if (
      isNaN(index) ||
      index < 1 ||
      !state.savedBankAccounts ||
      index > state.savedBankAccounts.length
    ) {
      await ctx.reply(Messages.INVALID_DELETE_INDEX(), { parse_mode: 'HTML' });
      return;
    }

    // Get the selected bank account (index is 1-based)
    const selectedAccount = state.savedBankAccounts[index - 1];

    // Find bank name
    const bank = banks.find((b) => b.id === selectedAccount.bank_id);
    const bankName = bank ? bank.short_name : 'N/A';

    // Store the payment info ID in state for confirmation
    state.paymentInfoId = selectedAccount.id;
    state.waitingFor = undefined;
    userStates.set(userId, state);

    logger.info(
      { userId, index, paymentInfoId: selectedAccount.id },
      'User selected bank account to delete'
    );

    // Show confirmation dialog
    await ctx.reply(
      Messages.CONFIRM_DELETE_BANK(
        bankName,
        selectedAccount.bank_account || 'N/A',
        selectedAccount.full_name
      ),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmDelete(),
      }
    );
  }

  /**
   * Handle delete wallet index input
   */
  private async handleDeleteWalletIndexInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const index = parseInt(text);

    // Validate index
    if (isNaN(index) || index < 1 || !state.savedWallets || index > state.savedWallets.length) {
      await ctx.reply(Messages.INVALID_DELETE_INDEX(), { parse_mode: 'HTML' });
      return;
    }

    // Get the selected wallet (index is 1-based)
    const selectedWallet = state.savedWallets[index - 1];

    // Store the payment info ID in state for confirmation
    state.paymentInfoId = selectedWallet.id;
    state.waitingFor = undefined;
    userStates.set(userId, state);

    logger.info(
      { userId, index, paymentInfoId: selectedWallet.id },
      'User selected wallet to delete'
    );

    // Show confirmation dialog
    await ctx.reply(Messages.CONFIRM_DELETE_WALLET(selectedWallet.wallet_address || 'N/A'), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.confirmDelete(),
    });
  }

  /**
   * Handle KYC ID card photo upload
   * Note: State locking (waitingFor = 'kyc_processing') is handled by the caller
   */
  private async handleKycIdCardPhoto(ctx: any, userId: number, state: UserState): Promise<void> {
    logger.info({ userId }, 'Processing ID card photo');

    // Increment KYC attempt counter at the very start
    // This ensures we count ALL attempts, including those that fail during image processing or FPT API calls
    await teleUserService.incrementKycAttempts(userId);
    logger.info({ userId }, 'Incremented KYC attempt counter');

    // Show processing message
    await ctx.reply(Messages.KYC_PROCESSING_IMAGE(), {
      parse_mode: 'HTML',
    });

    try {
      // Get the largest photo (best quality)
      const photos = ctx.message.photo;
      const photo = photos[photos.length - 1];

      logger.info(
        { userId, fileId: photo.file_id, fileUniqueId: photo.file_unique_id },
        'Downloading photo from Telegram'
      );

      // Download the photo
      const file = await ctx.api.getFile(photo.file_id);
      const filePath = file.file_path;

      if (!filePath) {
        throw new Error('Failed to get file path');
      }

      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Save image to /data folder with chat_id as filename
      const localFilePath = path.join(dataDir, `${userId}.jpg`);
      const fileUrl = `https://api.telegram.org/file/bot${telegramConfig.botToken}/${filePath}`;

      // Download and save the file
      const axios = require('axios');
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(localFilePath);

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      logger.info({ userId, localFilePath }, 'ID card image saved to disk');

      // Get document type from state (default to 'cccd' for backward compatibility)
      const documentType = state.kycDocumentType || 'cccd';

      // Call FPT AI Vision API (this is the expensive operation we want to avoid duplicating)
      logger.info({ userId, documentType }, 'Calling FPT AI Vision API');
      const idData = await fptAiVisionService.recognizeIdCard(localFilePath, documentType);
      logger.info({ userId, documentType, idData }, 'FPT AI Vision API call successful');

      // Upload image to S3
      logger.info({ userId, localFilePath }, 'Uploading KYC image to S3');
      const s3Url = await s3Service.uploadKycImage(localFilePath, userId);
      logger.info({ userId, s3Url }, 'KYC image uploaded to S3 successfully');

      // Clean up temporary local file after successful S3 upload
      try {
        fs.unlinkSync(localFilePath);
        logger.info({ userId, localFilePath }, 'Temporary KYC image file deleted from local disk');
      } catch (deleteError) {
        // Log warning but don't fail the KYC process if file deletion fails
        logger.warn(
          { userId, localFilePath, error: deleteError },
          'Failed to delete temporary KYC image file, but S3 upload was successful'
        );
      }

      // Store extracted data and S3 URL in state
      state.kycIdCardData = idData;
      state.kycImageUrl = s3Url;
      userStates.set(userId, state);

      logger.info({ userId }, 'ID card data extracted, automatically saving to database');

      // Automatically save KYC data to database (no confirmation needed)
      await this.saveKycData(ctx, userId, state);
    } catch (error) {
      logger.error({ error, userId }, 'Error processing ID card photo');

      // Show error message and allow retry
      await ctx.reply(Messages.KYC_IMAGE_ERROR(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });

      // Reset state to allow retry
      state.waitingFor = 'kyc_id_card';
      state.lastProcessedPhotoId = undefined; // Clear so user can retry with same or different photo
      userStates.set(userId, state);

      // Re-throw to let caller know there was an error
      throw error;
    }
  }

  /**
   * Save KYC data to database
   */
  private async saveKycData(ctx: any, userId: number, state: UserState): Promise<void> {
    const idData = state.kycIdCardData;
    const phoneNumber = state.kycPhoneNumber;
    const documentType = state.kycDocumentType || 'cccd';
    const kycImageUrl = state.kycImageUrl;

    if (!idData || !phoneNumber) {
      throw new Error('Missing KYC data');
    }

    logger.info({ userId, documentType, kycImageUrl }, 'Saving KYC data to database');

    // Note: time_kyc counter is already incremented in handleKycIdCardPhoto
    // We don't increment here to avoid double-counting

    try {
      // Parse dates
      const dob = fptAiVisionService.parseDate(idData.dob);
      const doe = fptAiVisionService.parseDate(idData.doe);

      if (!dob || !doe) {
        throw new Error('Invalid date format in ID card data');
      }

      // Determine KYC type and extract passport number if applicable
      const kycType: 'PASSPORT' | 'IDC' = documentType === 'passport' ? 'PASSPORT' : 'IDC';
      const passportNumber =
        documentType === 'passport' && idData.passport_number ? idData.passport_number : undefined;

      // Handle home and address fields based on document type
      // For passports: use pob (place of birth) since passports don't have home/address fields
      // For CCCD: use the standard home and address fields
      const home = documentType === 'passport' ? idData.pob || 'N/A' : idData.home || 'N/A';
      const address = documentType === 'passport' ? idData.pob || 'N/A' : idData.address || 'N/A';

      // Extract ID number based on document type
      // For passport documents: use id_number (CCCD number from passport)
      // For CCCD documents: use id (CCCD number)
      const idNumber = documentType === 'passport' ? idData.id_number : idData.id;

      // Parse sex field for database storage (normalize to English abbreviation)
      // API returns different formats: CCCD="NAM"/"NỮ", Passport="NAM/M"/"NỮ/F"
      // Store only the English abbreviation: "M" or "F"
      const sexForDatabase = this.parseSexForDatabase(idData.sex);

      // Create KYC record
      await kycService.create({
        chat_id: userId,
        phone: phoneNumber,
        type: kycType,
        id_number: idNumber,
        name: idData.name,
        dob: dob,
        sex: sexForDatabase,
        nationality: idData.nationality,
        home: home,
        address: address,
        doe: doe,
        passport_number: passportNumber,
        kyc_image: kycImageUrl,
      });

      // Update is_kyc flag in tele_users table
      await teleUserService.updateKycStatus(userId, true);

      logger.info({ userId }, 'KYC data saved successfully');

      // Clear user state
      userStates.delete(userId);

      // Show success message with user's name
      // Use ctx.reply instead of ctx.editMessageText because ctx is from a photo message, not a callback query
      await ctx.reply(Messages.KYC_SAVE_SUCCESS(idData.name, phoneNumber), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    } catch (error: any) {
      // Check if this is a duplicate ID number error
      const isDuplicateError = this.isDuplicateKeyError(error);

      if (isDuplicateError) {
        // Log for fraud detection (only last 4 digits for privacy)
        const idNumberLast4 = idData.id ? idData.id.slice(-4) : 'unknown';
        logger.warn(
          {
            userId,
            idNumberLast4,
            errorCode: error.code,
            errorMessage: error.message,
          },
          'Duplicate ID card number detected - ID already registered to another account'
        );

        // DO NOT update is_kyc flag
        // DO NOT clear user state - allow them to try with different ID
        // Note: time_kyc was already incremented at the start of saveKycData

        // Show user-friendly error message
        // Use ctx.reply instead of ctx.editMessageText because ctx is from a photo message
        await ctx.reply(Messages.KYC_ID_ALREADY_REGISTERED(idNumberLast4), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycDuplicateIdError(),
        });

        // Don't re-throw - we've handled this error
        return;
      }

      // For other errors, just re-throw
      // Note: We don't increment here because if we reached the success path (line 3588),
      // we already incremented. We should only increment once per attempt.
      logger.error({ error, userId }, 'Error saving KYC data to database');
      throw error;
    }
  }

  /**
   * Check if error is a duplicate key constraint violation
   * MySQL error code 1062 = ER_DUP_ENTRY
   */
  private isDuplicateKeyError(error: any): boolean {
    if (!error) return false;

    // Check MySQL error code
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return true;
    }

    // Check error message for duplicate key patterns
    const errorMessage = error.message?.toLowerCase() || '';
    if (
      errorMessage.includes('duplicate') ||
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('duplicate entry')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get bot instance for webhook handling
   */
  getBot(): Bot {
    return this.bot;
  }

  /**
   * Start bot (for polling mode - not used in production)
   */
  async start(): Promise<void> {
    await this.bot.start();
  }
}

export default new TelegramService();
