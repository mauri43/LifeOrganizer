import WidgetKit
import SwiftUI

extension Date {
    func ISO8601Format() -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}

// Widget data model
struct WidgetData: Codable {
    let date: String
    let activities: [ActivityItem]
    let tasks: [TaskItem]
    let weather: WeatherData?
    let lastUpdated: String
}

struct ActivityItem: Codable {
    let id: String
    let title: String
    let time: String
    let notes: String
}

struct TaskItem: Codable {
    let id: String
    let title: String
    let priority: String
    let completed: Bool
}

struct WeatherData: Codable {
    let temp: Int
    let description: String
    let icon: String
}

// Widget timeline entry
struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
}

// Widget provider
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            data: WidgetData(
                date: Date().ISO8601Format(),
                activities: [
                    ActivityItem(id: "1", title: "Team Meeting", time: "10:00 AM", notes: "")
                ],
                tasks: [
                    TaskItem(id: "1", title: "Complete project", priority: "high", completed: false)
                ],
                weather: WeatherData(temp: 72, description: "Sunny", icon: "clear"),
                lastUpdated: Date().ISO8601Format()
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), data: loadWidgetData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let currentDate = Date()
        let entry = SimpleEntry(date: currentDate, data: loadWidgetData())
        
        // Refresh every hour
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private func loadWidgetData() -> WidgetData? {
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.mauricio.lifeorganizer"),
              let dataString = sharedDefaults.string(forKey: "widgetData"),
              let data = dataString.data(using: .utf8),
              let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) else {
            return nil
        }
        return widgetData
    }
}

// Widget view
struct LifeOrganizerWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        case .systemLarge:
            LargeWidgetView(data: entry.data)
        default:
            MediumWidgetView(data: entry.data)
        }
    }
}

// Small widget view
struct SmallWidgetView: View {
    let data: WidgetData?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let data = data {
                // Weather
                if let weather = data.weather {
                    HStack {
                        Text("\(weather.temp)°")
                            .font(.system(size: 32, weight: .bold))
                        Spacer()
                        weatherIcon(for: weather.icon)
                    }
                    Text(weather.description.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Divider()
                
                // Tasks count
                if !data.tasks.isEmpty {
                    HStack {
                        Image(systemName: "checkmark.circle")
                        Text("\(data.tasks.count) tasks")
                            .font(.caption)
                    }
                }
                
                // Activities count
                if !data.activities.isEmpty {
                    HStack {
                        Image(systemName: "calendar")
                        Text("\(data.activities.count) activities")
                            .font(.caption)
                    }
                }
            } else {
                Text("No data available")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    
    @ViewBuilder
    private func weatherIcon(for icon: String) -> some View {
        switch icon.lowercased() {
        case "clear":
            Image(systemName: "sun.max.fill")
                .foregroundColor(.yellow)
        case "clouds":
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        case "rain", "drizzle":
            Image(systemName: "cloud.rain.fill")
                .foregroundColor(.blue)
        case "snow":
            Image(systemName: "cloud.snow.fill")
                .foregroundColor(.white)
        default:
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        }
    }
}

// Medium widget view
struct MediumWidgetView: View {
    let data: WidgetData?
    
    var body: some View {
        HStack(spacing: 16) {
            // Left: Weather
            if let data = data, let weather = data.weather {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("\(weather.temp)°")
                            .font(.system(size: 48, weight: .bold))
                        Spacer()
                        weatherIcon(for: weather.icon)
                            .font(.system(size: 40))
                    }
                    Text(weather.description.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
            }
            
            // Right: Tasks and Activities
            VStack(alignment: .leading, spacing: 12) {
                if let data = data {
                    // Tasks
                    if !data.tasks.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Tasks")
                                .font(.headline)
                            ForEach(data.tasks.prefix(3), id: \.id) { task in
                                HStack {
                                    Circle()
                                        .fill(priorityColor(for: task.priority))
                                        .frame(width: 8, height: 8)
                                    Text(task.title)
                                        .font(.caption)
                                        .lineLimit(1)
                                }
                            }
                            if data.tasks.count > 3 {
                                Text("+\(data.tasks.count - 3) more")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    // Activities
                    if !data.activities.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Activities")
                                .font(.headline)
                            ForEach(data.activities.prefix(2), id: \.id) { activity in
                                HStack {
                                    if !activity.time.isEmpty {
                                        Text(activity.time)
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                    Text(activity.title)
                                        .font(.caption)
                                        .lineLimit(1)
                                }
                            }
                            if data.activities.count > 2 {
                                Text("+\(data.activities.count - 2) more")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                } else {
                    Text("No data available")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
    }
    
    @ViewBuilder
    private func weatherIcon(for icon: String) -> some View {
        switch icon.lowercased() {
        case "clear":
            Image(systemName: "sun.max.fill")
                .foregroundColor(.yellow)
        case "clouds":
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        case "rain", "drizzle":
            Image(systemName: "cloud.rain.fill")
                .foregroundColor(.blue)
        case "snow":
            Image(systemName: "cloud.snow.fill")
                .foregroundColor(.white)
        default:
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        }
    }
    
    private func priorityColor(for priority: String) -> Color {
        switch priority.lowercased() {
        case "high":
            return .red
        case "medium":
            return .orange
        case "low":
            return .green
        default:
            return .gray
        }
    }
}

// Large widget view
struct LargeWidgetView: View {
    let data: WidgetData?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Weather header
            if let data = data, let weather = data.weather {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Today")
                            .font(.headline)
                        Text(weather.description.capitalized)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Text("\(weather.temp)°")
                            .font(.system(size: 48, weight: .bold))
                        weatherIcon(for: weather.icon)
                            .font(.system(size: 40))
                    }
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
            }
            
            // Tasks section
            if let data = data, !data.tasks.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tasks")
                        .font(.headline)
                    ForEach(data.tasks.prefix(5), id: \.id) { task in
                        HStack {
                            Circle()
                                .fill(priorityColor(for: task.priority))
                                .frame(width: 10, height: 10)
                            Text(task.title)
                                .font(.body)
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            
            // Activities section
            if let data = data, !data.activities.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Activities")
                        .font(.headline)
                    ForEach(data.activities.prefix(5), id: \.id) { activity in
                        HStack {
                            if !activity.time.isEmpty {
                                Text(activity.time)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .frame(width: 60, alignment: .leading)
                            }
                            Text(activity.title)
                                .font(.body)
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            
            if data == nil {
                Text("No data available")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
    }
    
    @ViewBuilder
    private func weatherIcon(for icon: String) -> some View {
        switch icon.lowercased() {
        case "clear":
            Image(systemName: "sun.max.fill")
                .foregroundColor(.yellow)
        case "clouds":
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        case "rain", "drizzle":
            Image(systemName: "cloud.rain.fill")
                .foregroundColor(.blue)
        case "snow":
            Image(systemName: "cloud.snow.fill")
                .foregroundColor(.white)
        default:
            Image(systemName: "cloud.fill")
                .foregroundColor(.gray)
        }
    }
    
    private func priorityColor(for priority: String) -> Color {
        switch priority.lowercased() {
        case "high":
            return .red
        case "medium":
            return .orange
        case "low":
            return .green
        default:
            return .gray
        }
    }
}

// Widget configuration
struct LifeOrganizerWidget: Widget {
    let kind: String = "LifeOrganizerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            LifeOrganizerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Life Organizer")
        .description("View your today's tasks, activities, and weather at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// Widget bundle
@main
struct LifeOrganizerWidgetBundle: WidgetBundle {
    var body: some Widget {
        LifeOrganizerWidget()
    }
}

