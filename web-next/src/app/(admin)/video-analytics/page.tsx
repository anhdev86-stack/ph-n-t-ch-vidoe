"use client";

import React, { useState, useEffect } from "react";
import {
  Typography,
  Select,
  DatePicker,
  Button,
  Table,
  Card,
  Row,
  Col,
  Statistic,
  message,
  ConfigProvider,
  Spin,
  Alert,
  Tooltip,
  Progress,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, ShoppingOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
  TikTokAccount,
  ExtractedVideoItem,
  ExtractedVideoProduct,
  VideoAnalyticsResponse,
} from "../../../types/tikTokTypes";
import { tikTokAccountService } from "../../../services/tikTokAccountService";
import { useAuth } from "../../../lib/auth";

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function VideoAnalyticsPage() {
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    undefined
  );
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(7, "day"),
    dayjs(),
  ]);
  const [data, setData] = useState<VideoAnalyticsResponse | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Sản phẩm đã bán theo videoId (lấy on-demand, có cache ở backend)
  const [videoProducts, setVideoProducts] = useState<
    Record<string, ExtractedVideoProduct[]>
  >({});
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [productProgress, setProductProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAccounts();
    }
  }, [isAdmin]);

  const fetchAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const result = await tikTokAccountService.getAllAccounts();
      setAccounts(result);
      if (result.length > 0) {
        setSelectedAccountId(result[0]._id);
      }
    } catch (error) {
      messageApi.error("Không thể tải danh sách tài khoản");
      console.error("Lỗi khi lấy danh sách tài khoản:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedAccountId) {
      messageApi.error("Vui lòng chọn một tài khoản!");
      return;
    }
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      messageApi.error("Vui lòng chọn khoảng thời gian!");
      return;
    }

    setIsLoading(true);
    try {
      const from = dateRange[0].format("YYYY-MM-DD");
      // end_date_lt là loại trừ nên +1 ngày để bao gồm cả ngày kết thúc đã chọn
      const to = dateRange[1].add(1, "day").format("YYYY-MM-DD");
      const result = await tikTokAccountService.getVideoAnalytics(
        selectedAccountId,
        from,
        to
      );
      setData(result);
      // Reset sản phẩm đã bán khi đổi kết quả phân tích
      setVideoProducts({});
      setProductProgress(null);
    } catch (error) {
      messageApi.error("Không thể tải dữ liệu phân tích video");
      console.error("Lỗi khi lấy phân tích video:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lấy sản phẩm ĐÃ BÁN cho tất cả video CÓ đơn/GMV > 0, theo lô, hiển thị tiến độ.
  const handleFetchProducts = async () => {
    if (!data || !selectedAccountId || !dateRange || !dateRange[0] || !dateRange[1]) {
      return;
    }
    const from = dateRange[0].format("YYYY-MM-DD");
    const to = dateRange[1].add(1, "day").format("YYYY-MM-DD");
    // Chỉ lấy cho video thực sự bán được (bỏ video 0 đơn & 0 GMV)
    const ids = data.videos
      .filter((v) => v.gmv > 0 || v.skuOrders > 0)
      .map((v) => v.videoId);
    if (ids.length === 0) {
      messageApi.info("Không có video nào phát sinh đơn/GMV để lấy sản phẩm.");
      return;
    }

    setIsFetchingProducts(true);
    setProductProgress({ done: 0, total: ids.length });
    const CHUNK = 30;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await tikTokAccountService.getVideoProducts(
          selectedAccountId,
          from,
          to,
          chunk
        );
        setVideoProducts((prev) => ({ ...prev, ...res.products }));
        setProductProgress({
          done: Math.min(i + CHUNK, ids.length),
          total: ids.length,
        });
      }
      messageApi.success(`Đã lấy sản phẩm đã bán cho ${ids.length} video.`);
    } catch (error) {
      messageApi.error("Lỗi khi lấy sản phẩm đã bán.");
      console.error("Lỗi khi lấy sản phẩm đã bán:", error);
    } finally {
      setIsFetchingProducts(false);
    }
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(value || 0);

  const columns: ColumnsType<ExtractedVideoItem> = [
    {
      title: "ID video",
      dataIndex: "videoId",
      key: "videoId",
      width: 130,
      ellipsis: true,
      render: (value: string) => value || "-",
    },
    {
      title: "Link",
      dataIndex: "videoLink",
      key: "videoLink",
      width: 80,
      render: (value: string) =>
        value ? (
          <a href={value} target="_blank" rel="noopener noreferrer">
            Xem
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      width: 280,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <span
            style={{
              display: "block",
              maxWidth: 270,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Người đăng",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Sản phẩm đã bán",
      key: "products",
      width: 300,
      render: (_: unknown, record) => {
        const list = videoProducts[record.videoId];
        if (!list) {
          return <span style={{ color: "#bbb" }}>—</span>;
        }
        if (list.length === 0) {
          return <span style={{ color: "#999" }}>Không có</span>;
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {list.map((p) => (
              <Tooltip
                key={p.productId}
                title={`${p.productName || p.productId} • ${formatNumber(
                  p.gmv
                )} ${data?.currency || ""} • ${p.unitsSold} SP`}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 290,
                    display: "block",
                  }}
                >
                  {p.productName || p.productId}{" "}
                  <span style={{ color: "#B8912F" }}>×{p.unitsSold}</span>
                </span>
              </Tooltip>
            ))}
          </div>
        );
      },
    },
    {
      title: "GMV",
      dataIndex: "gmv",
      key: "gmv",
      align: "right",
      sorter: (a, b) => a.gmv - b.gmv,
      render: (value: number, record) =>
        `${formatNumber(value)} ${record.currency}`,
    },
    {
      title: "Đơn",
      dataIndex: "skuOrders",
      key: "skuOrders",
      align: "right",
      sorter: (a, b) => a.skuOrders - b.skuOrders,
      render: (value: number) => formatNumber(value),
    },
    {
      title: "Lượt xem",
      dataIndex: "views",
      key: "views",
      align: "right",
      sorter: (a, b) => a.views - b.views,
      render: (value: number) => formatNumber(value),
    },
    {
      title: "CTR",
      dataIndex: "ctr",
      key: "ctr",
      align: "right",
      sorter: (a, b) => a.ctr - b.ctr,
      render: (value: number) => `${(value || 0).toFixed(2)}%`,
    },
    {
      title: "Ngày đăng",
      dataIndex: "postedAt",
      key: "postedAt",
    },
  ];

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Spin size="large" />
          <div className="mt-2">Đang kiểm tra quyền truy cập...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Alert
          message="Không có quyền truy cập"
          description="Bạn cần có quyền admin để truy cập trang này."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <ConfigProvider componentSize={isMobile ? "small" : "middle"}>
      <div>
        {contextHolder}
        <Title level={isMobile ? 3 : 2}>Phân tích Video</Title>

        <div
          className={`flex ${
            isMobile ? "flex-col" : "flex-row"
          } gap-3 mb-6 ${isMobile ? "items-stretch" : "items-center"}`}
        >
          <Select
            placeholder="Chọn tài khoản"
            loading={isLoadingAccounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            style={{ minWidth: isMobile ? "100%" : 240 }}
            options={accounts.map((acc) => ({
              value: acc._id,
              label: acc.shopCipher?.[0]?.name || acc.appKey,
            }))}
          />
          <RangePicker
            value={dateRange}
            onChange={(values) =>
              setDateRange(values as [Dayjs, Dayjs] | null)
            }
            format="DD/MM/YYYY"
            style={{ minWidth: isMobile ? "100%" : 260 }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={isLoading}
            onClick={handleSearch}
          >
            Phân tích
          </Button>
        </div>

        {data && (
          <>
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Tổng video"
                    value={data.kpis.totalVideos}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="GMV"
                    value={data.kpis.totalGmv}
                    precision={2}
                    suffix={data.currency}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Lượt xem"
                    value={data.kpis.totalViews}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="CTR"
                    value={data.kpis.avgCtr}
                    precision={2}
                    suffix="%"
                  />
                </Card>
              </Col>
            </Row>

            <div
              className={`flex ${
                isMobile ? "flex-col" : "flex-row"
              } gap-3 mb-4 ${isMobile ? "items-stretch" : "items-center"}`}
            >
              <Button
                icon={<ShoppingOutlined />}
                loading={isFetchingProducts}
                onClick={handleFetchProducts}
              >
                Lấy sản phẩm đã bán (video có đơn)
              </Button>
              {productProgress && (
                <div style={{ minWidth: isMobile ? "100%" : 260 }}>
                  <Progress
                    percent={Math.round(
                      (productProgress.done / productProgress.total) * 100
                    )}
                    size="small"
                    status={isFetchingProducts ? "active" : "success"}
                    format={() =>
                      `${productProgress.done}/${productProgress.total} video`
                    }
                  />
                </div>
              )}
            </div>

            <Table
              rowKey="videoId"
              columns={columns}
              dataSource={data.videos}
              loading={isLoading}
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10, showSizeChanger: true }}
            />
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
