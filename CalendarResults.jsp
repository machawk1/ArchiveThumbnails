<%@   page language="java" pageEncoding="utf-8" contentType="text/html;charset=utf-8"
%><%@ page import="java.util.List"
%><%@ page import="java.util.ArrayList"
%><%@ page import="java.util.Date"
%><%@ page import="java.util.Iterator"
%><%@ page import="java.text.ParseException"
%><%@ page import="org.archive.wayback.WaybackConstants"
%><%@ page import="org.archive.wayback.core.CaptureSearchResult"
%><%@ page import="org.archive.wayback.core.CaptureSearchResults"
%><%@ page import="org.archive.wayback.core.UIResults"
%><%@ page import="org.archive.wayback.core.WaybackRequest"
%><%@ page import="org.archive.wayback.partition.CaptureSearchResultPartitionMap"
%><%@ page import="org.archive.wayback.util.partition.Partition"
%><%@ page import="org.archive.wayback.util.partition.Partitioner"
%><%@ page import="org.archive.wayback.util.partition.PartitionSize"
%><%@ page import="org.archive.wayback.util.StringFormatter"
%><jsp:include page="/WEB-INF/template/UI-header.jsp" flush="true" />
<jsp:include page="/WEB-INF/template/CookieJS.jsp" flush="true" /><%

UIResults results = UIResults.extractCaptureQuery(request);

WaybackRequest wbRequest = results.getWbRequest();
CaptureSearchResults cResults = results.getCaptureResults();
StringFormatter fmt = wbRequest.getFormatter();
String searchString = fmt.escapeHtml(wbRequest.getRequestUrl());
List<String> closeMatches = cResults.getCloseMatches();

String staticPrefix = results.getStaticPrefix();
String queryPrefix = results.getQueryPrefix();
String replayPrefix = results.getReplayPrefix();

Date searchStartDate = wbRequest.getStartDate();
Date searchEndDate = wbRequest.getEndDate();
long firstResult = cResults.getFirstReturned();
long lastResult = cResults.getReturnedCount() + firstResult;
long resultCount = cResults.getMatchingCount();

CaptureSearchResultPartitionMap map = 
	new CaptureSearchResultPartitionMap();
Partitioner<CaptureSearchResult> partitioner = 
	new Partitioner<CaptureSearchResult>(map);
PartitionSize size = partitioner.getSize(searchStartDate,searchEndDate,13);
List<Partition<CaptureSearchResult>> partitions = 
	partitioner.getRange(size,searchStartDate,searchEndDate);

Iterator<CaptureSearchResult> it = cResults.iterator();
partitioner.populate(partitions,it);
int numPartitions = partitions.size();
%>
<table border="0" cellpadding="5" width="100%" class="mainSearchBanner" cellspacing="0">
   <tr>
      <td>
            <%= fmt.format("PathQueryClassic.searchedFor",searchString) %>
      </td>
      <td align="right">
            Set Anchor Window:
            <jsp:include page="/WEB-INF/template/AnchorWindow.jsp" flush="true" />
            <%= fmt.format("PathQueryClassic.resultsSummary",resultCount) %>
      </td>
   </tr>
</table>
<br>


<iframe src="http://localhost:15421/?access=wayback&URI-R=<%= searchString %>" style="width: 100%; height: 500px; text-align: center; border: 0;"></iframe>
<jsp:include page="/WEB-INF/template/UI-footer.jsp" flush="true" />
