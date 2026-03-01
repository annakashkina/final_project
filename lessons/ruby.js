export const rubyLessons = { name: "Ruby", lessons: [
  {
    id: "ruby-blocks-procs",
    title: "Blocks, Procs & Lambdas",
    difficulty: "Essential",
    icon: "🧱",
    description:
      "Ruby's most unique feature: code blocks you pass to methods. Once you get blocks, Ruby's elegance clicks.",
    concepts: [
      "Blocks with do..end and {}",
      "yield to call a block",
      "Procs vs lambdas",
      "&block capture",
    ],
    bridges: {
      Python: "Like passing a lambda or function to map/filter, but in Ruby blocks are built into the syntax — no import needed.",
      Java: "Like functional interfaces and lambdas (Runnable, Consumer), but lighter — no type annotations.",
      JavaScript: "Like arrow functions passed as callbacks, but Ruby has a dedicated yield keyword instead of calling the function explicitly.",
    },
    code: `# Blocks: code you pass to a method
3.times { |i| puts "count: #{i}" }

# yield calls the block
def greet(name)
  yield(name) if block_given?
end
greet("Ada") { |n| puts "Hello, #{n}!" }

# Proc: a saved block (object you can store)
shout = Proc.new { |msg| puts msg.upcase }
shout.call("hello")   # HELLO

# Lambda: stricter Proc (checks arg count)
double = ->(x) { x * 2 }
puts double.(5)        # 10

# &block captures block as a Proc
def transform(list, &block)
  list.map(&block)
end
puts transform([1, 2, 3]) { |x| x ** 2 }.inspect  # [1, 4, 9]`,
    seedQuestions: [
      "What's the difference between a block and a Proc?",
      "Why does yield need block_given? — what happens without it?",
      "When would I use a lambda vs a Proc?",
    ],
  },

  {
    id: "ruby-classes-modules",
    title: "Classes, Modules & Mixins",
    difficulty: "Essential",
    icon: "💎",
    description:
      "Ruby is deeply object-oriented — everything is an object, even numbers. Modules let you share behavior without inheritance.",
    concepts: [
      "Classes and initialize",
      "attr_accessor / attr_reader",
      "Modules as mixins (include)",
      "Method lookup chain",
    ],
    bridges: {
      Python: "Like __init__ and @property, but Ruby uses attr_accessor for boilerplate-free getters/setters. Mixins are like multiple inheritance but safer.",
      Java: "Like classes + interfaces, but modules can carry real method implementations — like default methods in interfaces, but more powerful.",
      JavaScript: "Like ES6 classes, but Ruby has real mixins via include. No prototype chain — Ruby uses a method lookup path through ancestors.",
    },
    code: `puts 42.even?          # true — everything is an object

class Dog
  attr_reader :name        # getter
  attr_accessor :energy    # getter + setter

  def initialize(name)
    @name = name           # @ = instance variable
    @energy = 100
  end

  def play
    @energy -= 20
    "#{@name} plays! Energy: #{@energy}"
  end
end

rex = Dog.new("Rex")
puts rex.play              # Rex plays! Energy: 80

# Modules = mixins (shared behavior without inheritance)
module Greetable
  def greet = "Hi, I'm #{name}!"
end

class Person
  include Greetable
  attr_reader :name
  def initialize(name) = @name = name
end

puts Person.new("Ada").greet   # Hi, I'm Ada!
puts Person.ancestors.inspect
# [Person, Greetable, Object, Kernel, BasicObject]`,
    seedQuestions: [
      "What does attr_reader actually generate under the hood?",
      "Why can the Greetable module call 'name' when it doesn't define it?",
      "How is 'include' different from inheritance?",
      "What does the ancestors chain tell you about method lookup?",
    ],
  },

  {
    id: "ruby-enumerable",
    title: "Enumerable & Iterators",
    difficulty: "Core",
    icon: "🔄",
    description:
      "Ruby's Enumerable module gives any collection 50+ methods for free. map, select, reduce — and much more expressive ones.",
    concepts: [
      "map, select, reject",
      "reduce / inject",
      "each_with_object",
      "Chaining and lazy enumerators",
    ],
    bridges: {
      Python: "Like list comprehensions and itertools, but in Ruby these are methods you chain together instead of nesting syntax.",
      Java: "Like Java Streams (map, filter, reduce), but available on every collection by default and more concise.",
      JavaScript: "Like Array's map/filter/reduce, but Ruby has 50+ more methods and they work on any object that includes Enumerable.",
    },
    code: `nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

puts nums.map { |n| n ** 2 }.inspect    # [1, 4, 9, ...]
puts nums.select(&:even?).inspect       # [2, 4, 6, 8, 10]
puts nums.reject(&:even?).inspect       # [1, 3, 5, 7, 9]
puts nums.reduce(:+)                    # 55

# Chain: sum of squares of evens
result = nums.select(&:even?).map { |n| n ** 2 }.reduce(:+)
puts result   # 220

# Lazy: infinite sequences, computed on demand
squares = (1..Float::INFINITY).lazy.select(&:even?).map { |n| n ** 2 }
puts squares.first(5).inspect  # [4, 16, 36, 64, 100]`,
    seedQuestions: [
      "What does the &:even? shorthand actually do?",
      "When would you use each_with_object instead of reduce?",
      "What does .lazy change about how the chain executes?",
    ],
  },

  {
    id: "ruby-symbols-hashes",
    title: "Symbols & Hashes",
    difficulty: "Essential",
    icon: "🔑",
    description:
      "Symbols are Ruby's lightweight identifiers — not strings, not variables. Hashes use them everywhere. Understanding symbols unlocks idiomatic Ruby.",
    concepts: [
      "Symbols vs strings",
      "Hash syntax (rocket vs colon)",
      "Keyword arguments",
      "Destructuring with values_at",
    ],
    bridges: {
      Python: "Python has no equivalent to symbols. Ruby symbols are like interned strings — same object in memory every time. Hashes are like Python dicts.",
      Java: "Symbols are like enum constants — fixed identifiers. Hashes are like LinkedHashMap with flexible keys.",
      JavaScript: "Symbols exist in JS too (Symbol()), but Ruby symbols are simpler — just :name. Hashes are like JS objects but with any type as keys.",
    },
    code: `# Symbols are immutable identifiers
puts :hello.class           # Symbol
puts :hello.object_id == :hello.object_id  # true — always same object
puts "hello".object_id == "hello".object_id # false — new String each time

# Hash with symbols — two equivalent syntaxes
old_style = { :name => "Ada", :age => 36 }    # hash rocket
new_style = { name: "Ada", age: 36 }          # colon shorthand (Ruby 1.9+)
puts old_style == new_style   # true

# Accessing values
person = { name: "Ada", role: :engineer, languages: ["Ruby", "Python"] }
puts person[:name]            # Ada
puts person[:missing]         # nil — no error!
puts person.fetch(:missing, "default")  # default

# Keyword arguments use symbol keys
def connect(host:, port: 5432, ssl: false)
  puts "Connecting to #{host}:#{port} (ssl: #{ssl})"
end

connect(host: "db.example.com")              # port defaults to 5432
connect(host: "db.example.com", ssl: true)   # override ssl

# Double splat collects keyword args into a hash
def log(message, **opts)
  puts "[#{opts[:level] || :info}] #{message}"
  puts "  tags: #{opts[:tags].inspect}" if opts[:tags]
end

log("deployed", level: :warn, tags: [:prod, :v2])
# [warn] deployed
#   tags: [:prod, :v2]`,
    seedQuestions: [
      "Why are symbols more efficient than strings for hash keys?",
      "What happens if I forget a required keyword argument?",
      "What does ** do with keyword arguments?",
    ],
  },

  // ===== CODEBASE LESSON: Sidekiq =====
  {
    id: "ruby-sidekiq-worker",
    title: "Sidekiq: Background Jobs in Practice",
    difficulty: "Project",
    icon: "📦",
    description:
      "Sidekiq is Ruby's most popular background job processor. See how real-world Ruby uses modules, classes, and metaprogramming to make async work dead simple.",
    concepts: [
      "Module as namespace + mixin",
      "ClassMethods pattern (included hook)",
      "Method options with hashes",
      "Thread-safe job processing",
    ],
    bridges: {
      Python: "Like Celery's @task decorator, but Ruby uses include + class-level options instead of decorators.",
      Java: "Like @Async methods in Spring, but Sidekiq workers are plain classes — no framework annotations.",
      JavaScript: "Like Bull/BullMQ job processors, but with Ruby's mixin pattern instead of separate processor functions.",
    },
    files: [
      {
        name: "worker.rb",
        code: `# Simplified from Sidekiq's actual Worker module
# This is how Sidekiq lets you write: include Sidekiq::Worker

module Sidekiq
  module Worker
    def self.included(base)
      # When a class does 'include Sidekiq::Worker',
      # this hook fires and extends the CLASS with ClassMethods
      base.extend(ClassMethods)
      base.sidekiq_options("queue" => "default", "retry" => true)
    end

    module ClassMethods
      def sidekiq_options(opts = {})
        @sidekiq_options = get_sidekiq_options.merge(opts)
      end

      def get_sidekiq_options
        @sidekiq_options || { "queue" => "default", "retry" => true }
      end

      def perform_async(*args)
        # Push a job to Redis for background processing
        job = {
          "class" => self.name,
          "args"  => args,
          "queue" => get_sidekiq_options["queue"],
          "retry" => get_sidekiq_options["retry"],
          "jid"   => SecureRandom.hex(12)
        }
        Sidekiq::Client.push(job)
        job["jid"]
      end
    end

    # Instance method — this is what Sidekiq calls when running the job
    # Subclasses override this
    def perform(*args)
      raise NotImplementedError, "#{self.class} must implement #perform"
    end
  end
end`,
      },
      {
        name: "usage.rb",
        code: `# This is how you USE Sidekiq in your app — clean and simple
require "sidekiq"

class WelcomeEmailWorker
  include Sidekiq::Worker
  sidekiq_options queue: "mailers", retry: 3

  def perform(user_id)
    user = User.find(user_id)
    Mailer.welcome(user).deliver
    puts "Sent welcome email to #{user.email}"
  end
end

class ReportWorker
  include Sidekiq::Worker
  sidekiq_options queue: "low", retry: false

  def perform(report_type, start_date)
    data = Analytics.generate(report_type, start_date)
    ReportStorage.save(report_type, data)
  end
end

# Enqueue jobs — returns immediately, runs in background
WelcomeEmailWorker.perform_async(42)
ReportWorker.perform_async("weekly", "2026-02-01")

# Each class got perform_async for free from the mixin.
# Sidekiq picks them up from Redis and calls #perform.`,
      },
    ],
    seedQuestions: [
      "How does 'include Sidekiq::Worker' give the class a perform_async method?",
      "What's the difference between include and extend here?",
      "Why does the included hook call base.extend(ClassMethods)?",
      "Why pass user_id instead of the user object to perform_async?",
    ],
  },
] };
